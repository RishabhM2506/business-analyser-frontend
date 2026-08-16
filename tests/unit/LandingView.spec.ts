import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError, apiRequest } from '@/services/api'
import { ROUTE_NAMES, ROUTE_PATHS } from '@/constants/routes'
import LandingView from '@/views/LandingView.vue'

vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>()
  return { ...actual, apiRequest: vi.fn() }
})

const mockedApiRequest = vi.mocked(apiRequest)

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: ROUTE_PATHS[ROUTE_NAMES.LANDING], name: ROUTE_NAMES.LANDING, component: LandingView },
      {
        path: ROUTE_PATHS[ROUTE_NAMES.HS_CATEGORY],
        name: ROUTE_NAMES.HS_CATEGORY,
        component: { template: '<div>categories</div>' },
      },
    ],
  })
}

async function mountLanding() {
  const router = makeRouter()
  await router.push({ name: ROUTE_NAMES.LANDING })
  await router.isReady()
  const wrapper = mount(LandingView, { global: { plugins: [router] } })
  return { wrapper, router }
}

describe('LandingView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockedApiRequest.mockReset()
  })

  it('shows the entry point with a "Start my process" button', async () => {
    const { wrapper } = await mountLanding()
    expect(wrapper.find('h1').text()).toBe('Business Analyser')
    expect(wrapper.find('button').text()).toBe('Start my process')
  })

  it("plainly states this is India's trade data (M22/PBO-04)", async () => {
    // Previously nowhere in the app stated whose trade data this was.
    const { wrapper } = await mountLanding()
    expect(wrapper.text()).toContain("India's")
  })

  it('clicking "Start my process" creates a thread (POST /threads) and navigates to the category picker', async () => {
    mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-1' })
    const { wrapper, router } = await mountLanding()

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(mockedApiRequest).toHaveBeenCalledWith('/threads', { method: 'POST' })
    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.HS_CATEGORY)
  })

  it('shows an actionable error state and does not navigate if thread creation fails', async () => {
    mockedApiRequest.mockRejectedValueOnce(
      new ApiError({
        httpStatus: null,
        errorCode: 'NETWORK_ERROR',
        message: 'Could not reach the server. Check your connection and try again.',
        retryable: true,
        traceId: null,
      }),
    )
    const { wrapper, router } = await mountLanding()

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('Could not reach the server')
    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.LANDING)
  })

  it('retrying from the error state can still succeed and navigate', async () => {
    mockedApiRequest.mockRejectedValueOnce(
      new ApiError({
        httpStatus: null,
        errorCode: 'NETWORK_ERROR',
        message: 'Could not reach the server.',
        retryable: true,
        traceId: null,
      }),
    )
    const { wrapper, router } = await mountLanding()
    await wrapper.find('button').trigger('click')
    await flushPromises()

    mockedApiRequest.mockResolvedValueOnce({ thread_id: 'thread-1' })
    await wrapper.find('button').trigger('click') // the Retry button, inside ErrorState
    await flushPromises()

    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.HS_CATEGORY)
  })
})
