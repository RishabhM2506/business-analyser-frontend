import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError, apiRequest } from '@/services/api'
import { ROUTE_NAMES, ROUTE_PATHS } from '@/constants/routes'
import AnalysisView from '@/views/AnalysisView.vue'

import {
  FIXTURE_EMPTY_TRADE_ANALYSIS_RESPONSE,
  FIXTURE_TRADE_ANALYSIS_RESPONSE,
} from '../fixtures/tradeAnalysisResponse'

vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>()
  return { ...actual, apiRequest: vi.fn() }
})

const mockedApiRequest = vi.mocked(apiRequest)

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message)
  return value
}

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: ROUTE_PATHS[ROUTE_NAMES.HS_CATEGORY],
        name: ROUTE_NAMES.HS_CATEGORY,
        component: { template: '<div>categories</div>' },
      },
      {
        path: ROUTE_PATHS[ROUTE_NAMES.ANALYSIS],
        name: ROUTE_NAMES.ANALYSIS,
        component: AnalysisView,
        props: true,
      },
      {
        path: ROUTE_PATHS[ROUTE_NAMES.TRADE_REPORT],
        name: ROUTE_NAMES.TRADE_REPORT,
        component: { template: '<div>trade report</div>' },
        props: true,
      },
    ],
  })
}

async function mountAnalysisView(hsCode = '010121') {
  const router = makeRouter()
  await router.push({ name: ROUTE_NAMES.ANALYSIS, params: { hsCode } })
  await router.isReady()

  const wrapper = mount(AnalysisView, { props: { hsCode }, global: { plugins: [router] } })
  return { wrapper, router }
}

describe('AnalysisView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockedApiRequest.mockReset()
  })

  it('shows a loading state immediately, never a blank screen, while the query is in flight', async () => {
    mockedApiRequest.mockReturnValueOnce(new Promise(() => {})) // createThread never resolves
    const { wrapper } = await mountAnalysisView()
    await flushPromises()

    expect(wrapper.text()).toContain('Fetching trade data')
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })

  it('renders the item description, both trade tables with real formatted numbers, and provenance on success', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockResolvedValueOnce({ type: 'final', data: FIXTURE_TRADE_ANALYSIS_RESPONSE })
    const { wrapper } = await mountAnalysisView('010121')
    await flushPromises()

    expect(wrapper.text()).toContain('What this item is')
    expect(wrapper.text()).toContain('Live, pure-bred breeding horses')
    expect(wrapper.text()).toContain('Imports')
    expect(wrapper.text()).toContain('Exports')
    // A real number taken verbatim from the fixture — proves the table
    // renders backend-supplied figures, not something recomputed.
    expect(wrapper.text()).toContain('$2,505,000.00')
    expect(wrapper.text()).toContain('UN Comtrade (comtradeapi.un.org)')
    expect(mockedApiRequest).toHaveBeenCalledTimes(2)
  })

  it('renders the trade balance section with the backend-supplied figures (2026-09-02, Step 3 hardening)', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockResolvedValueOnce({ type: 'final', data: FIXTURE_TRADE_ANALYSIS_RESPONSE })
    const { wrapper } = await mountAnalysisView('010121')
    await flushPromises()

    expect(wrapper.text()).toContain('Trade balance')
    expect(wrapper.text()).toContain('net importer')
    // The cumulative figure taken verbatim from the fixture.
    expect(wrapper.text()).toContain('-$3,425,000.00')
  })

  it('sends no years/top_n by default, then re-queries with the user-chosen values on Apply', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockResolvedValueOnce({ type: 'final', data: FIXTURE_TRADE_ANALYSIS_RESPONSE })
    const { wrapper } = await mountAnalysisView('010121')
    await flushPromises()

    // Second call is the /messages POST; its body must omit years/top_n
    // entirely so the backend applies its own default (never guessed
    // client-side) — regression for the "application end to end is not
    // working" years/top-N configurability gap.
    const firstQueryBody = mockedApiRequest.mock.calls[1]?.[1]?.body as Record<string, unknown>
    expect(firstQueryBody.years).toBeUndefined()
    expect(firstQueryBody.top_n).toBeUndefined()

    const numberInputs = wrapper.findAll('input[type="number"]')
    await required(numberInputs[0], 'expected a years input').setValue('3')
    await required(numberInputs[1], 'expected a top_n input').setValue('15')

    mockedApiRequest.mockResolvedValueOnce({ type: 'final', data: FIXTURE_TRADE_ANALYSIS_RESPONSE })
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const secondQueryBody = mockedApiRequest.mock.calls[2]?.[1]?.body as Record<string, unknown>
    expect(secondQueryBody.years).toBe(3)
    expect(secondQueryBody.top_n).toBe(15)
  })

  it('shows an actionable error state (not a blank screen or raw error) on upstream timeout, offering retry', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockRejectedValueOnce(
      new ApiError({
        httpStatus: 504,
        errorCode: 'UPSTREAM_TIMEOUT',
        message: 'The trade data source took too long to respond.',
        retryable: true,
        traceId: 'trace-timeout',
      }),
    )
    const { wrapper } = await mountAnalysisView()
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('took too long')
    expect(wrapper.find('button').exists()).toBe(true) // retryable -> Retry offered
  })

  it('shows a retryable error state for budget exhaustion, matching the real backend (retryable:true), plus explanatory copy instead of a bare Retry button', async () => {
    // Regression test for Phase 4 finding M19/Frontend-QA#7: the real
    // backend (app/nodes/describe_item.py, app/nodes/summarize.py) always
    // constructs BUDGET_EXCEEDED with retryable=True — this suite used to
    // hardcode retryable:false here, which is exactly the cross-repo
    // contract drift the finding caught (every test passed while asserting
    // the wrong thing against the real backend).
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockRejectedValueOnce(
      new ApiError({
        httpStatus: 429,
        errorCode: 'BUDGET_EXCEEDED',
        message: 'This service has reached its usage limit for now.',
        retryable: true,
        traceId: 'trace-budget',
      }),
    )
    const { wrapper } = await mountAnalysisView()
    await flushPromises()

    expect(wrapper.text()).toContain('usage limit')
    // retryable:true -> ErrorState does render its Retry button (a bare
    // "Retry" with zero context is itself the poor-UX half of this finding
    // — see the explanatory copy assertion below).
    expect(wrapper.find('button').exists()).toBe(true)
    expect(wrapper.text()).toContain('shared across all users')
    expect(wrapper.text()).toContain('tomorrow')
  })

  it('offers a "choose a different category" link specifically for an INVALID_HS_CODE error', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockRejectedValueOnce(
      new ApiError({
        httpStatus: 400,
        errorCode: 'INVALID_HS_CODE',
        message: 'That item code is not recognized.',
        retryable: false,
        traceId: 'trace-invalid',
      }),
    )
    const { wrapper } = await mountAnalysisView('000000')
    await flushPromises()

    const link = wrapper.findAll('a').find((a) => a.text().includes('Choose a different category'))
    expect(link).toBeDefined()
  })

  it('clicking Retry re-runs the same query', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockRejectedValueOnce(
      new ApiError({
        httpStatus: 504,
        errorCode: 'UPSTREAM_TIMEOUT',
        message: 'Timed out.',
        retryable: true,
        traceId: 'trace-1',
      }),
    )
    const { wrapper } = await mountAnalysisView()
    await flushPromises()
    expect(mockedApiRequest).toHaveBeenCalledTimes(2) // create + failed message

    mockedApiRequest.mockResolvedValueOnce({ type: 'final', data: FIXTURE_TRADE_ANALYSIS_RESPONSE })
    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(mockedApiRequest).toHaveBeenCalledTimes(3) // retried message (thread already exists)
    expect(wrapper.text()).toContain('What this item is')
  })

  it('shows an explicit empty state — not two blank-looking tables — when the response has zero rows in both flows', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockResolvedValueOnce({
      type: 'final',
      data: FIXTURE_EMPTY_TRADE_ANALYSIS_RESPONSE,
    })
    const { wrapper } = await mountAnalysisView('999999')
    await flushPromises()

    expect(wrapper.text()).toContain('No trade data is available')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('re-queries when the hsCode prop changes under the same mounted view', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockResolvedValueOnce({ type: 'final', data: FIXTURE_TRADE_ANALYSIS_RESPONSE })
    const { wrapper } = await mountAnalysisView('010121')
    await flushPromises()
    expect(mockedApiRequest).toHaveBeenCalledTimes(2)

    mockedApiRequest.mockResolvedValueOnce({
      type: 'final',
      data: { ...FIXTURE_TRADE_ANALYSIS_RESPONSE, hs_code: '160100' },
    })
    await wrapper.setProps({ hsCode: '160100' })
    await flushPromises()

    expect(mockedApiRequest).toHaveBeenCalledTimes(3) // no new createThread — thread already exists
    expect(wrapper.text()).toContain('HS 160100')
  })
})
