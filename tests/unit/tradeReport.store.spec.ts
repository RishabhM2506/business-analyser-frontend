import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest } from '@/services/api'
import { useTradeReportStore } from '@/stores/tradeReport'
import { useThreadStore } from '@/stores/thread'

vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>()
  return { ...actual, apiRequest: vi.fn() }
})

const mockedApiRequest = vi.mocked(apiRequest)

const FIXTURE_RESPONSE = {
  thread_id: 'thread-1',
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
      status: 'NOT_FOUND' as const,
      matched_item: null,
      year: null,
      india_status: null,
      india_production_tonnes: null,
      world_production_tonnes: null,
    },
  },
  narrative: 'A real, grounded narrative.',
  narrative_source: 'model' as const,
}

describe('useTradeReportStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockedApiRequest.mockReset()
  })

  it('starts with clean, empty state', () => {
    const store = useTradeReportStore()
    expect(store.result).toBeNull()
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  describe('fetchReport', () => {
    it('creates a thread implicitly if none exists yet, then fetches the report', async () => {
      const store = useTradeReportStore()
      expect(useThreadStore().threadId).toBeNull()

      mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-1' }) // POST /threads
      mockedApiRequest.mockResolvedValueOnce(FIXTURE_RESPONSE) // POST /trade-report

      await store.fetchReport({ hs_code: '120791' })

      expect(useThreadStore().threadId).toBe('thread-1')
      expect(store.result).toEqual(FIXTURE_RESPONSE)
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
      expect(mockedApiRequest).toHaveBeenCalledTimes(2)
    })

    it('does not create a second thread on a subsequent fetch once one already exists', async () => {
      const threadStore = useThreadStore()
      mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-1' })
      await threadStore.startThread()

      const store = useTradeReportStore()
      mockedApiRequest.mockResolvedValueOnce(FIXTURE_RESPONSE)
      await store.fetchReport({ hs_code: '120791' })

      expect(mockedApiRequest).toHaveBeenCalledTimes(2) // 1 create (in startThread) + 1 report fetch
      expect(store.result).toEqual(FIXTURE_RESPONSE)
    })

    it('sets a normalized error and never fetches the report if implicit thread creation fails', async () => {
      const store = useTradeReportStore()
      mockedApiRequest.mockRejectedValueOnce(
        new ApiError({
          httpStatus: 500,
          errorCode: 'UPSTREAM_TIMEOUT',
          message: 'The server took too long.',
          retryable: true,
          traceId: 't1',
        }),
      )

      await store.fetchReport({ hs_code: '120791' })

      expect(store.error?.errorCode).toBe('UPSTREAM_TIMEOUT')
      expect(store.result).toBeNull()
      expect(store.loading).toBe(false)
      expect(mockedApiRequest).toHaveBeenCalledTimes(1) // only the failed thread creation
    })

    it('sets a normalized error and leaves result null when the report call itself fails', async () => {
      mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-1' })
      await useThreadStore().startThread()
      const store = useTradeReportStore()

      mockedApiRequest.mockRejectedValueOnce(
        new ApiError({
          httpStatus: 429,
          errorCode: 'BUDGET_EXCEEDED',
          message: 'Budget exhausted.',
          retryable: true,
          traceId: 't2',
        }),
      )

      await store.fetchReport({ hs_code: '120791' })

      expect(store.result).toBeNull()
      expect(store.error?.errorCode).toBe('BUDGET_EXCEEDED')
      expect(store.loading).toBe(false)
    })

    it('discards a stale in-flight response when a newer fetchReport has since started', async () => {
      mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-1' })
      await useThreadStore().startThread()
      const store = useTradeReportStore()

      let resolveFirst: (value: unknown) => void = () => {}
      mockedApiRequest.mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
      const firstFetch = store.fetchReport({ hs_code: '120791' })

      mockedApiRequest.mockResolvedValueOnce({
        ...FIXTURE_RESPONSE,
        facts: { ...FIXTURE_RESPONSE.facts, hs6: '090111' },
      })
      const secondFetch = store.fetchReport({ hs_code: '090111' })
      await secondFetch

      expect(store.result?.facts.hs6).toBe('090111')

      resolveFirst(FIXTURE_RESPONSE)
      await firstFetch

      expect(store.result?.facts.hs6).toBe('090111')
      expect(store.loading).toBe(false)
    })
  })

  describe('reset', () => {
    it('clears result, loading, and error', async () => {
      mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-1' })
      await useThreadStore().startThread()
      const store = useTradeReportStore()
      mockedApiRequest.mockResolvedValueOnce(FIXTURE_RESPONSE)
      await store.fetchReport({ hs_code: '120791' })

      store.reset()

      expect(store.result).toBeNull()
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })
  })
})
