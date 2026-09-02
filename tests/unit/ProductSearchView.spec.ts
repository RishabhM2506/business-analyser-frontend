import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError, apiRequest } from '@/services/api'
import { ROUTE_NAMES, ROUTE_PATHS } from '@/constants/routes'
import ProductSearchView from '@/views/ProductSearchView.vue'
import type { ProductSearchResponse } from '@/types/generated'

vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>()
  return { ...actual, apiRequest: vi.fn() }
})

const mockedApiRequest = vi.mocked(apiRequest)

function fixtureResponse(overrides: Partial<ProductSearchResponse> = {}): ProductSearchResponse {
  return {
    thread_id: 't1',
    query_text: 'green coffee beans',
    outcome: 'auto_selected',
    selected_hs_code: '090111',
    candidates: [],
    ...overrides,
  }
}

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: ROUTE_PATHS[ROUTE_NAMES.PRODUCT_SEARCH],
        name: ROUTE_NAMES.PRODUCT_SEARCH,
        component: ProductSearchView,
      },
      {
        path: ROUTE_PATHS[ROUTE_NAMES.ANALYSIS],
        name: ROUTE_NAMES.ANALYSIS,
        component: { template: '<div>analysis</div>' },
        props: true,
      },
      {
        path: ROUTE_PATHS[ROUTE_NAMES.HS_CATEGORY],
        name: ROUTE_NAMES.HS_CATEGORY,
        component: { template: '<div>categories</div>' },
      },
    ],
  })
}

async function mountProductSearchView() {
  const router = makeRouter()
  await router.push({ name: ROUTE_NAMES.PRODUCT_SEARCH })
  await router.isReady()

  const wrapper = mount(ProductSearchView, { global: { plugins: [router] } })
  return { wrapper, router }
}

async function submit(
  wrapper: Awaited<ReturnType<typeof mountProductSearchView>>['wrapper'],
  text: string,
) {
  await wrapper.find('input').setValue(text)
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

describe('ProductSearchView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockedApiRequest.mockReset()
  })

  it('disables the Search button until real text is entered', async () => {
    const { wrapper } = await mountProductSearchView()
    const button = wrapper.find('button')
    expect(button.attributes('disabled')).toBeDefined()

    await wrapper.find('input').setValue('  ')
    expect(button.attributes('disabled')).toBeDefined() // whitespace-only doesn't count

    await wrapper.find('input').setValue('mango')
    expect(button.attributes('disabled')).toBeUndefined()
  })

  it('shows a loading state while the search is in flight', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockReturnValueOnce(new Promise(() => {})) // search never resolves
    const { wrapper } = await mountProductSearchView()

    await wrapper.find('input').setValue('mango')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Searching')
    expect(wrapper.find('[role="status"]').text()).toContain('Searching')
  })

  it('auto-navigates straight to the analysis view on an auto_selected outcome', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockResolvedValueOnce(
      fixtureResponse({ outcome: 'auto_selected', selected_hs_code: '090111' }),
    )
    const { wrapper, router } = await mountProductSearchView()

    await submit(wrapper, 'green coffee beans')

    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.ANALYSIS)
    expect(router.currentRoute.value.params.hsCode).toBe('090111')
  })

  it('renders ranked candidates for disambiguation and never auto-navigates for that outcome', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockResolvedValueOnce(
      fixtureResponse({
        outcome: 'disambiguate',
        selected_hs_code: null,
        candidates: [
          { hs_code: '090111', description: 'Coffee, not roasted', relevance_score: 0.9 },
          { hs_code: '090121', description: 'Coffee, roasted', relevance_score: 0.5 },
        ],
      }),
    )
    const { wrapper, router } = await mountProductSearchView()

    await submit(wrapper, 'coffee')

    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.PRODUCT_SEARCH) // did not navigate away
    expect(wrapper.text()).toContain('Coffee, not roasted')
    expect(wrapper.text()).toContain('Coffee, roasted')
    expect(wrapper.text()).toContain('2 matching product codes found.')
  })

  it('selecting a disambiguation candidate navigates to its analysis', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockResolvedValueOnce(
      fixtureResponse({
        outcome: 'disambiguate',
        selected_hs_code: null,
        candidates: [{ hs_code: '090121', description: 'Coffee, roasted', relevance_score: 0.5 }],
      }),
    )
    const { wrapper, router } = await mountProductSearchView()
    await submit(wrapper, 'coffee')

    await wrapper.find('[role="option"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.ANALYSIS)
    expect(router.currentRoute.value.params.hsCode).toBe('090121')
  })

  it('shows an explicit empty state for no_candidates_found, distinct from an error', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockResolvedValueOnce(
      fixtureResponse({ outcome: 'no_candidates_found', selected_hs_code: null, candidates: [] }),
    )
    const { wrapper } = await mountProductSearchView()

    await submit(wrapper, 'asdfghjkl')

    expect(wrapper.text()).toContain('No matching product codes found.')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('shows an actionable error state on failure, offering retry of the same query', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 't1' })
    mockedApiRequest.mockRejectedValueOnce(
      new ApiError({
        httpStatus: 500,
        errorCode: 'INTERNAL_ERROR',
        message: 'The search could not be completed due to an internal error.',
        retryable: true,
        traceId: 'trace-1',
      }),
    )
    const { wrapper } = await mountProductSearchView()
    await submit(wrapper, 'mango')

    expect(wrapper.find('[role="alert"]').text()).toContain('internal error')

    mockedApiRequest.mockResolvedValueOnce(fixtureResponse())
    await wrapper.find('[role="alert"] button').trigger('click')
    await flushPromises()

    expect(mockedApiRequest).toHaveBeenCalledTimes(3) // failed search + retried search (thread already exists)
  })

  it('offers a link to browse by category as a fallback path', async () => {
    const { wrapper } = await mountProductSearchView()
    const link = wrapper.findAll('a').find((a) => a.text().includes('Browse by category'))
    expect(link).toBeDefined()
  })
})
