import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ROUTE_NAMES, ROUTE_PATHS } from '@/constants/routes'
import HsItemView from '@/views/HsItemView.vue'

import { FIXTURE_TAXONOMY } from '../fixtures/hsTaxonomy'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_TAXONOMY }),
  )
})

async function mountView(categoryCode: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: ROUTE_PATHS[ROUTE_NAMES.HS_CATEGORY],
        name: ROUTE_NAMES.HS_CATEGORY,
        component: { template: '<div/>' },
      },
      {
        path: ROUTE_PATHS[ROUTE_NAMES.HS_ITEM],
        name: ROUTE_NAMES.HS_ITEM,
        component: HsItemView,
        props: true,
      },
      {
        path: ROUTE_PATHS[ROUTE_NAMES.ANALYSIS],
        name: ROUTE_NAMES.ANALYSIS,
        component: { template: '<div>analysis</div>' },
        props: true,
      },
    ],
  })
  await router.push({ name: ROUTE_NAMES.HS_ITEM, params: { categoryCode } })
  await router.isReady()
  const wrapper = mount(HsItemView, { props: { categoryCode }, global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('HsItemView', () => {
  it('shows the category description as the page heading once the taxonomy loads', async () => {
    const { wrapper } = await mountView('01')
    expect(wrapper.find('h1').text()).toBe('Animals; live')
  })

  it('falls back to a generic heading if the category cannot be resolved (defensive, not expected in normal use)', async () => {
    const { wrapper } = await mountView('77')
    expect(wrapper.find('h1').text()).toBe('Category 77')
  })

  it('selecting an item in ItemList navigates to the analysis view with that hsCode', async () => {
    const { wrapper, router } = await mountView('01')
    const options = wrapper.findAll('[role="option"]')
    await options[0]?.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.ANALYSIS)
    expect(router.currentRoute.value.params.hsCode).toBe('010121')
  })
})
