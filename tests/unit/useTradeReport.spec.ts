import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTradeReport } from '@/composables/useTradeReport'
import { API_URLS } from '@/constants/apis'
import { apiRequest } from '@/services/api'

vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>()
  return { ...actual, apiRequest: vi.fn() }
})

const mockedApiRequest = vi.mocked(apiRequest)

const FIXTURE_RESPONSE = {
  thread_id: 'thread-abc',
  facts: {
    hs6: '120791',
    product_label: 'Oil seeds; poppy seeds, whether or not broken',
    flow: 'import',
    window: { years: 1, start_year: 2023, end_year: 2023 },
    top_n: 5,
    annual_series: [],
    month_wise_current_year: [],
    unit_value_trend: [],
    hhi_by_year: [],
    landed_cost: null,
    landed_cost_as_of_period: null,
    mismatch_checks: [],
    regulatory_note: null,
    regulatory_note_missing_warning: false,
    coverage: null,
    hs8_split_note: '',
    mandi_price: {
      status: 'NOT_FOUND' as const,
      matched_commodity: null,
      modal_price_inr_paise_per_qtl: null,
      price_date: null,
      market: null,
      state: null,
    },
    msp: {
      status: 'NOT_FOUND' as const,
      matched_commodity: null,
      year_label: null,
      msp_inr_paise_per_qtl: null,
      cost_inr_paise_per_qtl: null,
    },
    international_production: {
      status: 'OK' as const,
      matched_item: 'Poppy seed',
      year: 2024,
      india_status: 'NOT_FOUND' as const,
      india_production_tonnes: null,
      world_production_tonnes: '10592.010',
    },
  },
  narrative: 'A real, grounded narrative.',
  narrative_source: 'model' as const,
}

describe('useTradeReport', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset()
  })

  it('fetchReport() POSTs to the trade-report endpoint with the threadId substituted and the query as the body', async () => {
    mockedApiRequest.mockResolvedValueOnce(FIXTURE_RESPONSE)

    const { fetchReport } = useTradeReport()
    const result = await fetchReport('thread-abc', { hs_code: '120791' })

    expect(result).toEqual(FIXTURE_RESPONSE)
    expect(mockedApiRequest).toHaveBeenCalledWith(API_URLS.POST_TRADE_REPORT, {
      method: 'POST',
      params: { threadId: 'thread-abc' },
      body: { hs_code: '120791' },
    })
  })

  it('does not unwrap an envelope — the response is bare, matching post_search', async () => {
    mockedApiRequest.mockResolvedValueOnce(FIXTURE_RESPONSE)
    const { fetchReport } = useTradeReport()

    const result = await fetchReport('thread-abc', { hs_code: '120791' })

    expect(result.facts.hs6).toBe('120791')
    expect('type' in result).toBe(false)
  })

  it('isLoading is true while a request is in flight and false once it settles', async () => {
    let resolveRequest: (value: typeof FIXTURE_RESPONSE) => void = () => {}
    mockedApiRequest.mockReturnValueOnce(new Promise((resolve) => (resolveRequest = resolve)))

    const { isLoading, fetchReport } = useTradeReport()
    expect(isLoading.value).toBe(false)

    const pending = fetchReport('thread-abc', { hs_code: '120791' })
    expect(isLoading.value).toBe(true)

    resolveRequest(FIXTURE_RESPONSE)
    await pending

    expect(isLoading.value).toBe(false)
  })

  it('propagates a rejected fetchReport() rather than swallowing it', async () => {
    const failure = new Error('network down')
    mockedApiRequest.mockRejectedValueOnce(failure)
    const { fetchReport, isLoading } = useTradeReport()

    await expect(fetchReport('thread-abc', { hs_code: '120791' })).rejects.toBe(failure)
    expect(isLoading.value).toBe(false)
  })
})
