import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ROUTE_NAMES, ROUTE_PATHS } from '@/constants/routes'
import HsCategoryView from '@/views/HsCategoryView.vue'

import { FIXTURE_TAXONOMY } from '../fixtures/hsTaxonomy'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_TAXONOMY }),
  )
})

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: ROUTE_PATHS[ROUTE_NAMES.HS_CATEGORY],
        name: ROUTE_NAMES.HS_CATEGORY,
        component: HsCategoryView,
      },
      {
        path: ROUTE_PATHS[ROUTE_NAMES.HS_ITEM],
        name: ROUTE_NAMES.HS_ITEM,
        component: { template: '<div>items</div>' },
        props: true,
      },
    ],
  })
  await router.push({ name: ROUTE_NAMES.HS_CATEGORY })
  await router.isReady()
  const wrapper = mount(HsCategoryView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('HsCategoryView', () => {
  it('selecting a category in CategorySearch navigates to the item picker with that categoryCode', async () => {
    const { wrapper, router } = await mountView()
    await wrapper.find('input').trigger('focus')
    const options = wrapper.findAll('[role="option"]')
    await options[0]?.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.HS_ITEM)
    expect(router.currentRoute.value.params.categoryCode).toBe('01')
  })
})
