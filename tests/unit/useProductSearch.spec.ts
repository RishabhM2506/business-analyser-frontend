import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useProductSearch } from '@/composables/useProductSearch'
import { API_URLS } from '@/constants/apis'
import { apiRequest } from '@/services/api'

vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>()
  return { ...actual, apiRequest: vi.fn() }
})

const mockedApiRequest = vi.mocked(apiRequest)

const FIXTURE_RESPONSE = {
  thread_id: 'thread-abc',
  query_text: 'coffee',
  outcome: 'disambiguate' as const,
  selected_hs_code: null,
  candidates: [
    { hs_code: '090111', description: 'Coffee, not roasted', relevance_score: 0.6 },
    { hs_code: '090121', description: 'Coffee, roasted', relevance_score: 0.5 },
  ],
}

describe('useProductSearch', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset()
  })

  it('search() POSTs to the search endpoint with the threadId substituted and the query as the body', async () => {
    mockedApiRequest.mockResolvedValueOnce(FIXTURE_RESPONSE)

    const { search } = useProductSearch()
    const result = await search('thread-abc', { query_text: 'coffee' })

    expect(result).toEqual(FIXTURE_RESPONSE)
    expect(mockedApiRequest).toHaveBeenCalledWith(API_URLS.POST_SEARCH, {
      method: 'POST',
      params: { threadId: 'thread-abc' },
      body: { query_text: 'coffee' },
    })
  })

  it('does not unwrap an envelope — the response is bare, unlike sendMessage', async () => {
    // Regression guard: POST /threads/{id}/search deliberately returns a bare
    // ProductSearchResponse, not {type, data}-enveloped (see
    // app/main.py's post_search docstring / types/generated.ts's doc
    // comment) — search() must hand the resolved body back as-is.
    mockedApiRequest.mockResolvedValueOnce(FIXTURE_RESPONSE)
    const { search } = useProductSearch()

    const result = await search('thread-abc', { query_text: 'coffee' })

    expect(result.outcome).toBe('disambiguate')
    expect('type' in result).toBe(false)
  })

  it('isLoading is true while a request is in flight and false once it settles', async () => {
    let resolveRequest: (value: typeof FIXTURE_RESPONSE) => void = () => {}
    mockedApiRequest.mockReturnValueOnce(new Promise((resolve) => (resolveRequest = resolve)))

    const { isLoading, search } = useProductSearch()
    expect(isLoading.value).toBe(false)

    const pending = search('thread-abc', { query_text: 'coffee' })
    expect(isLoading.value).toBe(true)

    resolveRequest(FIXTURE_RESPONSE)
    await pending

    expect(isLoading.value).toBe(false)
  })

  it('propagates a rejected search() rather than swallowing it', async () => {
    const failure = new Error('network down')
    mockedApiRequest.mockRejectedValueOnce(failure)
    const { search, isLoading } = useProductSearch()

    await expect(search('thread-abc', { query_text: 'coffee' })).rejects.toBe(failure)
    expect(isLoading.value).toBe(false)
  })
})
