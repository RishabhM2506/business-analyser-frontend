import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest } from '@/services/api'
import { useThreadStore } from '@/stores/thread'

import { FIXTURE_TRADE_ANALYSIS_RESPONSE } from '../fixtures/tradeAnalysisResponse'

vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>()
  return { ...actual, apiRequest: vi.fn() }
})

const mockedApiRequest = vi.mocked(apiRequest)

describe('useThreadStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockedApiRequest.mockReset()
  })

  it('starts with clean, empty state', () => {
    const store = useThreadStore()
    expect(store.threadId).toBeNull()
    expect(store.messages).toEqual([])
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  describe('startThread', () => {
    it('creates a thread and stores its id', async () => {
      mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-1' })
      const store = useThreadStore()

      await store.startThread()

      expect(store.threadId).toBe('thread-1')
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('sets a normalized error and leaves threadId null when thread creation fails', async () => {
      mockedApiRequest.mockRejectedValueOnce(
        new ApiError({
          httpStatus: 500,
          errorCode: 'UPSTREAM_TIMEOUT',
          message: 'The server took too long.',
          retryable: true,
          traceId: 't1',
        }),
      )
      const store = useThreadStore()

      await store.startThread()

      expect(store.threadId).toBeNull()
      expect(store.loading).toBe(false)
      expect(store.error?.errorCode).toBe('UPSTREAM_TIMEOUT')
    })

    it("clears any previous thread/messages/error — a new thread must not carry over the old one's state", async () => {
      mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-1' })
      const store = useThreadStore()
      await store.startThread()
      mockedApiRequest.mockResolvedValueOnce({
        type: 'final',
        data: FIXTURE_TRADE_ANALYSIS_RESPONSE,
      })
      await store.submitQuery({ hs_code: '010121' })
      expect(store.messages).toHaveLength(1)

      mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-2' })
      await store.startThread()

      expect(store.threadId).toBe('thread-2')
      expect(store.messages).toEqual([])
    })
  })

  describe('submitQuery', () => {
    it('sends the query and appends the result to messages', async () => {
      mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-1' })
      const store = useThreadStore()
      await store.startThread()

      mockedApiRequest.mockResolvedValueOnce({
        type: 'final',
        data: FIXTURE_TRADE_ANALYSIS_RESPONSE,
      })
      await store.submitQuery({ hs_code: '010121' })

      expect(store.messages).toHaveLength(1)
      expect(store.messages[0]).toEqual(FIXTURE_TRADE_ANALYSIS_RESPONSE)
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('creates a thread implicitly if none exists yet (e.g. a deep link straight into AnalysisView)', async () => {
      const store = useThreadStore()
      expect(store.threadId).toBeNull()

      mockedApiRequest.mockResolvedValueOnce({ thread_id: 'implicit-thread' })
      mockedApiRequest.mockResolvedValueOnce({
        type: 'final',
        data: FIXTURE_TRADE_ANALYSIS_RESPONSE,
      })
      await store.submitQuery({ hs_code: '010121' })

      expect(store.threadId).toBe('implicit-thread')
      expect(store.messages).toHaveLength(1)
      expect(mockedApiRequest).toHaveBeenCalledTimes(2)
    })

    it('does not create a second thread on a subsequent query once one already exists', async () => {
      mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-1' })
      const store = useThreadStore()
      await store.startThread()

      mockedApiRequest.mockResolvedValueOnce({
        type: 'final',
        data: FIXTURE_TRADE_ANALYSIS_RESPONSE,
      })
      await store.submitQuery({ hs_code: '010121' })
      mockedApiRequest.mockResolvedValueOnce({
        type: 'final',
        data: FIXTURE_TRADE_ANALYSIS_RESPONSE,
      })
      await store.submitQuery({ hs_code: '160100' })

      expect(store.messages).toHaveLength(2)
      expect(mockedApiRequest).toHaveBeenCalledTimes(3) // 1 create + 2 messages
    })

    it('sets a normalized error and does not push a message when the query fails', async () => {
      mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-1' })
      const store = useThreadStore()
      await store.startThread()

      mockedApiRequest.mockRejectedValueOnce(
        new ApiError({
          httpStatus: 400,
          errorCode: 'INVALID_HS_CODE',
          message: 'That code is not recognized.',
          retryable: false,
          traceId: 't2',
        }),
      )
      await store.submitQuery({ hs_code: '000000' })

      expect(store.messages).toEqual([])
      expect(store.error?.errorCode).toBe('INVALID_HS_CODE')
      expect(store.loading).toBe(false)
    })

    it('discards a stale in-flight response when a newer submitQuery has since started', async () => {
      mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-1' })
      const store = useThreadStore()
      await store.startThread()

      let resolveFirst: (value: unknown) => void = () => {}
      mockedApiRequest.mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
      const firstQuery = store.submitQuery({ hs_code: '010121' })

      // A second query starts before the first has resolved.
      mockedApiRequest.mockResolvedValueOnce({
        type: 'final',
        data: { ...FIXTURE_TRADE_ANALYSIS_RESPONSE, hs_code: '160100' },
      })
      const secondQuery = store.submitQuery({ hs_code: '160100' })
      await secondQuery

      expect(store.messages).toHaveLength(1)
      expect(store.messages[0]?.hs_code).toBe('160100')

      // The first (stale) request now resolves late — it must not clobber
      // the newer result or flip loading back on.
      resolveFirst({
        type: 'final',
        data: { ...FIXTURE_TRADE_ANALYSIS_RESPONSE, hs_code: '010121' },
      })
      await firstQuery

      expect(store.messages).toHaveLength(1)
      expect(store.messages[0]?.hs_code).toBe('160100')
      expect(store.loading).toBe(false)
    })
  })

  describe('reset', () => {
    it('clears threadId, messages, loading, and error', async () => {
      mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-1' })
      const store = useThreadStore()
      await store.startThread()
      mockedApiRequest.mockResolvedValueOnce({
        type: 'final',
        data: FIXTURE_TRADE_ANALYSIS_RESPONSE,
      })
      await store.submitQuery({ hs_code: '010121' })

      store.reset()

      expect(store.threadId).toBeNull()
      expect(store.messages).toEqual([])
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })
  })
})
