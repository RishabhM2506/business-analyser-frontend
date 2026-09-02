import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest } from '@/services/api'
import { useSearchStore } from '@/stores/search'
import { useThreadStore } from '@/stores/thread'

vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>()
  return { ...actual, apiRequest: vi.fn() }
})

const mockedApiRequest = vi.mocked(apiRequest)

const FIXTURE_DISAMBIGUATE_RESPONSE = {
  thread_id: 'thread-1',
  query_text: 'coffee',
  outcome: 'disambiguate' as const,
  candidates: [{ hs_code: '090111', description: 'Coffee, not roasted', relevance_score: 0.6 }],
}

describe('useSearchStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockedApiRequest.mockReset()
  })

  it('starts with clean, empty state', () => {
    const store = useSearchStore()
    expect(store.queryText).toBe('')
    expect(store.result).toBeNull()
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  describe('runSearch', () => {
    it('creates a thread implicitly if none exists yet, then searches', async () => {
      const store = useSearchStore()
      expect(useThreadStore().threadId).toBeNull()

      mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-1' }) // POST /threads
      mockedApiRequest.mockResolvedValueOnce(FIXTURE_DISAMBIGUATE_RESPONSE) // POST /search

      await store.runSearch('coffee')

      expect(useThreadStore().threadId).toBe('thread-1')
      expect(store.result).toEqual(FIXTURE_DISAMBIGUATE_RESPONSE)
      expect(store.queryText).toBe('coffee')
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
      expect(mockedApiRequest).toHaveBeenCalledTimes(2)
    })

    it('does not create a second thread on a subsequent search once one already exists', async () => {
      const threadStore = useThreadStore()
      mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-1' })
      await threadStore.startThread()

      const store = useSearchStore()
      mockedApiRequest.mockResolvedValueOnce(FIXTURE_DISAMBIGUATE_RESPONSE)
      await store.runSearch('coffee')

      expect(mockedApiRequest).toHaveBeenCalledTimes(2) // 1 create (in the earlier startThread call) + 1 search
      expect(store.result).toEqual(FIXTURE_DISAMBIGUATE_RESPONSE)
    })

    it('sets a normalized error and never calls search if implicit thread creation fails', async () => {
      const store = useSearchStore()
      mockedApiRequest.mockRejectedValueOnce(
        new ApiError({
          httpStatus: 500,
          errorCode: 'UPSTREAM_TIMEOUT',
          message: 'The server took too long.',
          retryable: true,
          traceId: 't1',
        }),
      )

      await store.runSearch('coffee')

      expect(store.error?.errorCode).toBe('UPSTREAM_TIMEOUT')
      expect(store.result).toBeNull()
      expect(store.loading).toBe(false)
      expect(mockedApiRequest).toHaveBeenCalledTimes(1) // only the failed thread creation
    })

    it('sets a normalized error and leaves result null when the search call itself fails', async () => {
      mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-1' })
      await useThreadStore().startThread()
      const store = useSearchStore()

      mockedApiRequest.mockRejectedValueOnce(
        new ApiError({
          httpStatus: 429,
          errorCode: 'BUDGET_EXCEEDED',
          message: 'Budget exhausted.',
          retryable: true,
          traceId: 't2',
        }),
      )

      await store.runSearch('coffee')

      expect(store.result).toBeNull()
      expect(store.error?.errorCode).toBe('BUDGET_EXCEEDED')
      expect(store.loading).toBe(false)
    })

    it('sets result.outcome to disambiguate even for a high-confidence match, never navigating on its own', async () => {
      mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-1' })
      await useThreadStore().startThread()
      const store = useSearchStore()

      mockedApiRequest.mockResolvedValueOnce({
        thread_id: 'thread-1',
        query_text: 'green coffee beans',
        outcome: 'disambiguate' as const,
        candidates: [
          { hs_code: '090111', description: 'Coffee, not roasted', relevance_score: 0.95 },
        ],
      })
      await store.runSearch('green coffee beans')

      expect(store.result?.outcome).toBe('disambiguate')
      expect(store.result?.candidates).toHaveLength(1)
    })

    it('discards a stale in-flight response when a newer runSearch has since started', async () => {
      mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-1' })
      await useThreadStore().startThread()
      const store = useSearchStore()

      let resolveFirst: (value: unknown) => void = () => {}
      mockedApiRequest.mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
      const firstSearch = store.runSearch('coffee')

      mockedApiRequest.mockResolvedValueOnce({
        ...FIXTURE_DISAMBIGUATE_RESPONSE,
        query_text: 'tea',
      })
      const secondSearch = store.runSearch('tea')
      await secondSearch

      expect(store.result?.query_text).toBe('tea')

      resolveFirst({ ...FIXTURE_DISAMBIGUATE_RESPONSE, query_text: 'coffee' })
      await firstSearch

      expect(store.result?.query_text).toBe('tea')
      expect(store.loading).toBe(false)
    })

    it('clears any previous result and error at the start of a new search', async () => {
      mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-1' })
      await useThreadStore().startThread()
      const store = useSearchStore()

      mockedApiRequest.mockRejectedValueOnce(
        new ApiError({
          httpStatus: 429,
          errorCode: 'BUDGET_EXCEEDED',
          message: 'Budget exhausted.',
          retryable: true,
          traceId: 't3',
        }),
      )
      await store.runSearch('coffee')
      expect(store.error).not.toBeNull()

      mockedApiRequest.mockResolvedValueOnce(FIXTURE_DISAMBIGUATE_RESPONSE)
      await store.runSearch('coffee')

      expect(store.error).toBeNull()
      expect(store.result).toEqual(FIXTURE_DISAMBIGUATE_RESPONSE)
    })
  })

  describe('reset', () => {
    it('clears queryText, result, loading, and error', async () => {
      mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-1' })
      await useThreadStore().startThread()
      const store = useSearchStore()
      mockedApiRequest.mockResolvedValueOnce(FIXTURE_DISAMBIGUATE_RESPONSE)
      await store.runSearch('coffee')

      store.reset()

      expect(store.queryText).toBe('')
      expect(store.result).toBeNull()
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })
  })
})
