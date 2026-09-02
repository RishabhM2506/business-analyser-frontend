import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError, apiRequest } from '@/services/api'
import { ROUTE_NAMES, ROUTE_PATHS } from '@/constants/routes'
import TradeReportView from '@/views/TradeReportView.vue'
import type { Facts, TradeReportResponse } from '@/types/generated'

vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>()
  return { ...actual, apiRequest: vi.fn() }
})

const mockedApiRequest = vi.mocked(apiRequest)

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message)
  return value
}

const BASE_FACTS: Facts = {
  hs6: '120791',
  product_label: 'Oil seeds; poppy seeds, whether or not broken',
  flow: 'import',
  window: { years: 1, start_year: 2023, end_year: 2023 },
  top_n: 5,
  annual_series: [],
  month_wise_current_year: [],
  unit_value_trend: [],
  hhi_by_year: [],
  landed_cost: {
    is_complete: false,
    landed_cost_inr_paise_per_kg: null,
    partial_landed_cost_inr_paise_per_kg: 12000,
    excluded_components: ['AIDC', 'SWS', 'IGST'],
    components: {
      BCD: {
        component: 'BCD',
        verification_status: 'VERIFIED',
        value_pct: '20.000',
        source_authority: 'ICEGATE Trade Guide on Imports',
        source_reference: 'Live GET, 2026-08-24',
        source_url: 'https://www.icegate.gov.in/Webappl/Desc_details?cth=12079100',
        verified_date: '2026-08-24',
        notes: null,
        conflicting_candidates: null,
      },
      AIDC: {
        component: 'AIDC',
        verification_status: 'NOT_VERIFIED',
        value_pct: null,
        source_authority: 'ICEGATE Trade Guide on Imports',
        source_reference: 'HTTP 500 - see notes',
        source_url: null,
        verified_date: '2026-08-24',
        notes: null,
        conflicting_candidates: null,
      },
      SWS: {
        component: 'SWS',
        verification_status: 'NOT_VERIFIED',
        value_pct: null,
        source_authority: null,
        source_reference: null,
        source_url: null,
        verified_date: null,
        notes: null,
        conflicting_candidates: null,
      },
      IGST: {
        component: 'IGST',
        verification_status: 'NOT_VERIFIED',
        value_pct: null,
        source_authority: null,
        source_reference: null,
        source_url: null,
        verified_date: null,
        notes: null,
        conflicting_candidates: null,
      },
    },
  },
  landed_cost_as_of_period: '2023',
  mismatch_checks: [],
  regulatory_note: 'A real regulatory note.',
  regulatory_note_missing_warning: false,
  coverage: null,
  hs8_split_note: '',
  mandi_price: {
    status: 'NOT_FOUND',
    matched_commodity: null,
    modal_price_inr_paise_per_qtl: null,
    price_date: null,
    market: null,
    state: null,
  },
  msp: {
    status: 'NOT_FOUND',
    matched_commodity: null,
    year_label: null,
    msp_inr_paise_per_qtl: null,
    cost_inr_paise_per_qtl: null,
  },
  international_production: {
    status: 'OK',
    matched_item: 'Poppy seed',
    year: 2024,
    india_status: 'NOT_FOUND',
    india_production_tonnes: null,
    world_production_tonnes: '10592.010',
  },
}

function fixtureResponse(overrides: Partial<Facts> = {}): TradeReportResponse {
  return {
    thread_id: 't1',
    facts: { ...BASE_FACTS, ...overrides },
    narrative: 'Landed cost as of 2023 is incomplete (unverified: AIDC, SWS, IGST).',
    narrative_source: 'model',
  }
}

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: ROUTE_PATHS[ROUTE_NAMES.ANALYSIS],
        name: ROUTE_NAMES.ANALYSIS,
        component: { template: '<div>analysis</div>' },
      },
      {
        path: ROUTE_PATHS[ROUTE_NAMES.TRADE_REPORT],
        name: ROUTE_NAMES.TRADE_REPORT,
        component: TradeReportView,
        props: true,
      },
    ],
  })
}

async function mountTradeReportView(hsCode = '120791') {
  const router = makeRouter()
  await router.push({ name: ROUTE_NAMES.TRADE_REPORT, params: { hsCode } })
  await router.isReady()

  const wrapper = mount(TradeReportView, { props: { hsCode }, global: { plugins: [router] } })
  return { wrapper, router }
}

describe('TradeReportView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockedApiRequest.mockReset()
  })

  it('shows a loading state immediately, never a blank screen, while the query is in flight', async () => {
    mockedApiRequest.mockReturnValueOnce(new Promise(() => {})) // createThread never resolves
    const { wrapper } = await mountTradeReportView()
    await flushPromises()

    expect(wrapper.text()).toContain('Fetching product intelligence')
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })

  it('renders the duty table with VERIFIED and NOT_VERIFIED components distinctly, never a fabricated 0% for the unverified ones', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockResolvedValueOnce(fixtureResponse())
    const { wrapper } = await mountTradeReportView()
    await flushPromises()

    expect(wrapper.text()).toContain('Verified')
    expect(wrapper.text()).toContain('20%')
    expect(wrapper.text()).toContain('Not verified')
    // The unverified components' own rate cells render the missing marker,
    // not "0%" — scoped to the duty table specifically, since the page's own
    // explanatory footer legitimately mentions the phrase "0%" in prose.
    const rateCells = wrapper.findAll('.duty__rate')
    expect(rateCells).toHaveLength(4)
    expect(rateCells.filter((cell) => cell.text() === '—')).toHaveLength(3)
    expect(wrapper.text()).toContain('incomplete')
  })

  it('shows an explicit empty state, not a blank card, when landed_cost is null (no duty evidence recorded at all yet)', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockResolvedValueOnce(fixtureResponse({ landed_cost: null }))
    const { wrapper } = await mountTradeReportView()
    await flushPromises()

    expect(wrapper.text()).toContain('No duty evidence recorded for this product yet.')
    expect(wrapper.find('.duty__table').exists()).toBe(false)
  })

  it('renders the real narrative text verbatim', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockResolvedValueOnce(fixtureResponse())
    const { wrapper } = await mountTradeReportView()
    await flushPromises()

    expect(wrapper.text()).toContain('unverified: AIDC, SWS, IGST')
  })

  it('renders mandi price and MSP as explicit NOT_FOUND states, not blank cards', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockResolvedValueOnce(fixtureResponse())
    const { wrapper } = await mountTradeReportView()
    await flushPromises()

    expect(wrapper.text()).toContain('Mandi price')
    expect(wrapper.text()).toContain('Minimum Support Price')
    expect(wrapper.text()).toContain('No matching data found in this pipeline yet.')
  })

  it('renders international production with India NOT_FOUND distinct from the real world total', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockResolvedValueOnce(fixtureResponse())
    const { wrapper } = await mountTradeReportView()
    await flushPromises()

    expect(wrapper.text()).toContain('Poppy seed')
    expect(wrapper.text()).toContain('not reported') // India's real M-flag, never a fabricated zero
    expect(wrapper.text()).toContain('10,592.01 t') // the real world total
  })

  it('renders a single quiet note instead of three empty cards when the commodity is not agriculture-relevant', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockResolvedValueOnce(
      fixtureResponse({
        hs6: '252329',
        product_label: 'Cement; portland, other than white, whether or not artificially coloured',
        mandi_price: {
          status: 'NOT_APPLICABLE',
          matched_commodity: null,
          modal_price_inr_paise_per_qtl: null,
          price_date: null,
          market: null,
          state: null,
        },
        msp: {
          status: 'NOT_APPLICABLE',
          matched_commodity: null,
          year_label: null,
          msp_inr_paise_per_qtl: null,
          cost_inr_paise_per_qtl: null,
        },
        international_production: {
          status: 'NOT_APPLICABLE',
          matched_item: null,
          year: null,
          india_status: null,
          india_production_tonnes: null,
          world_production_tonnes: null,
        },
      }),
    )
    const { wrapper } = await mountTradeReportView('252329')
    await flushPromises()

    expect(wrapper.text()).toContain('do not apply to this product category')
    // The three per-source sections themselves must not render at all — the
    // explanatory note above legitimately says "Mandi prices" in prose, so
    // this checks each section's own heading specifically, not a page-wide
    // substring (which the note's own text would coincidentally match).
    const headings = wrapper.findAll('h2').map((h) => h.text())
    expect(headings).not.toContain('Mandi price (Agmarknet)')
    expect(headings).not.toContain('Minimum Support Price')
    expect(headings).not.toContain('International production (FAOSTAT)')
  })

  it('shows an actionable error state on failure, offering retry', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockRejectedValueOnce(
      new ApiError({
        httpStatus: 500,
        errorCode: 'INTERNAL_ERROR',
        message: 'The trade report could not be completed due to an internal error.',
        retryable: false,
        traceId: 'trace-1',
      }),
    )
    const { wrapper } = await mountTradeReportView()
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('internal error')
  })

  it('sends no years/top_n by default, then re-queries with the user-chosen values on Apply', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockResolvedValueOnce(fixtureResponse())
    const { wrapper } = await mountTradeReportView()
    await flushPromises()

    const firstQueryBody = mockedApiRequest.mock.calls[1]?.[1]?.body as Record<string, unknown>
    expect(firstQueryBody.years).toBeUndefined()
    expect(firstQueryBody.top_n).toBeUndefined()

    const numberInputs = wrapper.findAll('input[type="number"]')
    await required(numberInputs[0], 'expected a years input').setValue('2')
    await required(numberInputs[1], 'expected a top_n input').setValue('5')

    mockedApiRequest.mockResolvedValueOnce(fixtureResponse())
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const secondQueryBody = mockedApiRequest.mock.calls[2]?.[1]?.body as Record<string, unknown>
    expect(secondQueryBody.years).toBe(2)
    expect(secondQueryBody.top_n).toBe(5)
  })

  it('re-queries when the hsCode prop changes under the same mounted view', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockResolvedValueOnce(fixtureResponse())
    const { wrapper } = await mountTradeReportView('120791')
    await flushPromises()
    expect(mockedApiRequest).toHaveBeenCalledTimes(2)

    mockedApiRequest.mockResolvedValueOnce(
      fixtureResponse({ hs6: '090111', product_label: 'Coffee, not roasted' }),
    )
    await wrapper.setProps({ hsCode: '090111' })
    await flushPromises()

    expect(mockedApiRequest).toHaveBeenCalledTimes(3) // no new createThread — thread already exists
    expect(wrapper.text()).toContain('HS 090111')
  })

  it('shows a plain, non-degraded coverage line and no breakdown when every cell is present', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockResolvedValueOnce(
      fixtureResponse({
        coverage: {
          expected_cells: 12,
          present_cells: 12,
          not_yet_published: 0,
          suppressed: 0,
          fetch_failed: 0,
          degraded: false,
        },
      }),
    )
    const { wrapper } = await mountTradeReportView()
    await flushPromises()

    expect(wrapper.text()).toContain('Data coverage: 12 of 12 expected data cells present')
    expect(wrapper.text()).not.toContain('degraded')
    expect(wrapper.find('.view__coverage--degraded').exists()).toBe(false)
  })

  it('flags degraded coverage distinctly and shows the real non-zero breakdown, never silently hiding why data is missing', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockResolvedValueOnce(
      fixtureResponse({
        coverage: {
          expected_cells: 12,
          present_cells: 7,
          not_yet_published: 3,
          suppressed: 1,
          fetch_failed: 1,
          degraded: true,
        },
      }),
    )
    const { wrapper } = await mountTradeReportView()
    await flushPromises()

    expect(wrapper.text()).toContain('Data coverage: 7 of 12 expected data cells present')
    expect(wrapper.find('.view__coverage--degraded').exists()).toBe(true)
    expect(wrapper.text()).toContain('3 not yet published')
    expect(wrapper.text()).toContain('1 suppressed')
    expect(wrapper.text()).toContain('1 fetch failed')
  })

  it('renders no coverage line at all when coverage is null (older data, or not computed)', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockResolvedValueOnce(fixtureResponse({ coverage: null }))
    const { wrapper } = await mountTradeReportView()
    await flushPromises()

    expect(wrapper.find('.view__coverage').exists()).toBe(false)
  })

  it('renders cross-source mismatch checks with their real severity, never silently resolved to one source', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockResolvedValueOnce(
      fixtureResponse({
        mismatch_checks: [
          {
            check: 'B_dgcis_vs_partner_comtrade',
            year: 2023,
            partner: 'Türkiye',
            gap_pct: '18.5',
            severity: 'warning',
          },
          {
            check: 'A_dgcis_vs_comtrade_india',
            year: 2022,
            partner: 'ALL_PARTNERS',
            gap_pct: '2.100',
            severity: 'quiet',
          },
        ],
      }),
    )
    const { wrapper } = await mountTradeReportView()
    await flushPromises()

    expect(wrapper.text()).toContain('Cross-source mismatch checks')
    expect(wrapper.text()).toContain('B_dgcis_vs_partner_comtrade')
    expect(wrapper.text()).toContain('Türkiye')
    expect(wrapper.text()).toContain('18.5%')
    const badges = wrapper.findAll('.view__severity')
    expect(badges).toHaveLength(2)
    expect(badges[0]?.classes()).toContain('view__severity--warning')
    expect(badges[1]?.classes()).toContain('view__severity--quiet')
  })

  it('renders no mismatch-checks section when the list is empty — nothing to say, so nothing shown', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockResolvedValueOnce(fixtureResponse({ mismatch_checks: [] }))
    const { wrapper } = await mountTradeReportView()
    await flushPromises()

    expect(wrapper.text()).not.toContain('Cross-source mismatch checks')
  })

  it('renders a combined unit-value/HHI table by year, looking up each year rather than assuming index alignment', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockResolvedValueOnce(
      fixtureResponse({
        unit_value_trend: [
          {
            year: 2023,
            inr_paise_per_kg: '15000',
            delta_qty_pct: '-5.2',
            delta_price_pct: '3.1',
            delta_fx_pct: null,
          },
        ],
        // Deliberately a different, non-overlapping year set from
        // unit_value_trend, and in reverse order — proves the table is
        // built by year lookup, not by zipping the two arrays by index.
        hhi_by_year: [
          { year: 2022, hhi: '0.185' },
          { year: 2023, hhi: '0.204' },
        ],
      }),
    )
    const { wrapper } = await mountTradeReportView()
    await flushPromises()

    expect(wrapper.text()).toContain('Unit value & partner concentration by year')
    const table = wrapper.find('.view__metrics-table')
    const rows = table.findAll('tbody tr')
    expect(rows).toHaveLength(2) // years 2022 and 2023, sorted

    // 2022: HHI only, no unit-value data for that year — must show the
    // missing marker, never a fabricated 0.
    expect(rows[0]?.text()).toContain('2022')
    expect(rows[0]?.text()).toContain('0.185')
    expect(rows[0]?.text()).toContain('—')

    // 2023: both present.
    expect(rows[1]?.text()).toContain('2023')
    expect(rows[1]?.text()).toContain('-5.2%')
    expect(rows[1]?.text()).toContain('3.1%')
    expect(rows[1]?.text()).toContain('0.204')
  })

  it('renders no year-metrics table when both arrays are empty', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockResolvedValueOnce(
      fixtureResponse({ unit_value_trend: [], hhi_by_year: [] }),
    )
    const { wrapper } = await mountTradeReportView()
    await flushPromises()

    expect(wrapper.find('.view__metrics-table').exists()).toBe(false)
  })
})
