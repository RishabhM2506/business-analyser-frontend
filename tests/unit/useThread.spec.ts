import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useThread } from '@/composables/useThread'
import { API_URLS } from '@/constants/apis'
import { ApiError, apiRequest } from '@/services/api'

import { FIXTURE_TRADE_ANALYSIS_RESPONSE } from '../fixtures/tradeAnalysisResponse'

// Mock only apiRequest — keep the real ApiError class, since useThread's
// error propagation and the store's `instanceof ApiError` handling both
// depend on it being the genuine class, not a mock stand-in.
vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>()
  return { ...actual, apiRequest: vi.fn() }
})

const mockedApiRequest = vi.mocked(apiRequest)

describe('useThread', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset()
  })

  it('createThread() POSTs to the create-thread endpoint and stores the returned id', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-abc' })

    const { threadId, createThread } = useThread()
    const id = await createThread()

    expect(id).toBe('thread-abc')
    expect(threadId.value).toBe('thread-abc')
    expect(mockedApiRequest).toHaveBeenCalledWith(API_URLS.CREATE_THREAD, { method: 'POST' })
  })

  it('sendMessage() refuses to run before a thread exists', async () => {
    const { sendMessage } = useThread()

    await expect(sendMessage({ hs_code: '010121' })).rejects.toThrow(/no thread exists/i)
    expect(mockedApiRequest).not.toHaveBeenCalled()
  })

  it('sendMessage() POSTs to the message endpoint with the threadId substituted and the query as the body', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-abc' })
    const { createThread, sendMessage } = useThread()
    await createThread()

    mockedApiRequest.mockResolvedValueOnce({ type: 'final', data: FIXTURE_TRADE_ANALYSIS_RESPONSE })
    const result = await sendMessage({ hs_code: '010121' })

    // Vue's ref() wraps an assigned object in a reactive Proxy internally
    // (result flows through useStreamingResponse's `result` ref), so this is
    // deep-equal rather than the exact same reference — expected, not a bug.
    expect(result).toEqual(FIXTURE_TRADE_ANALYSIS_RESPONSE)
    expect(mockedApiRequest).toHaveBeenLastCalledWith(API_URLS.POST_MESSAGE, {
      method: 'POST',
      params: { threadId: 'thread-abc' },
      body: { hs_code: '010121' },
    })
  })

  it('isLoading is true while a request is in flight and false once it settles', async () => {
    let resolveRequest: (value: { thread_id: string }) => void = () => {}
    mockedApiRequest.mockReturnValueOnce(new Promise((resolve) => (resolveRequest = resolve)))

    const { isLoading, createThread } = useThread()
    expect(isLoading.value).toBe(false)

    const pending = createThread()
    expect(isLoading.value).toBe(true)

    resolveRequest({ thread_id: 'thread-abc' })
    await pending

    expect(isLoading.value).toBe(false)
  })

  it('propagates an ApiError from a failed sendMessage rather than swallowing it', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-abc' })
    const { createThread, sendMessage, isLoading } = useThread()
    await createThread()

    const budgetError = new ApiError({
      httpStatus: 429,
      errorCode: 'BUDGET_EXCEEDED',
      message: 'Daily budget exhausted.',
      retryable: false,
      traceId: 'trace-1',
    })
    mockedApiRequest.mockRejectedValueOnce(budgetError)

    await expect(sendMessage({ hs_code: '010121' })).rejects.toBe(budgetError)
    expect(isLoading.value).toBe(false)
  })

  it('rejects if the backend somehow resolves without a final chunk (e.g. only a "delta")', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-abc' })
    const { createThread, sendMessage } = useThread()
    await createThread()

    mockedApiRequest.mockResolvedValueOnce({ type: 'delta', data: {} })
    await expect(sendMessage({ hs_code: '010121' })).rejects.toThrow(/final result/i)
  })
})
