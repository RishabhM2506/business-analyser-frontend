import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import LoadingState from '@/components/common/LoadingState.vue'

describe('LoadingState', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the message and spinner immediately, with no "still working" note yet', () => {
    const wrapper = mount(LoadingState, { props: { message: 'Fetching trade data…' } })
    expect(wrapper.text()).toContain('Fetching trade data…')
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Still working')
  })

  it('shows a "still working" note only after slowAfterMs has elapsed, addressing the real ~2-minute worst-case Gemini wait with zero prior feedback', async () => {
    const wrapper = mount(LoadingState, {
      props: { message: 'Fetching…', slowAfterMs: 5000 },
    })
    expect(wrapper.text()).not.toContain('Still working')

    vi.advanceTimersByTime(4999)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).not.toContain('Still working')

    vi.advanceTimersByTime(1)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Still working')
  })

  it('defaults slowAfterMs to 8000ms', async () => {
    const wrapper = mount(LoadingState)
    vi.advanceTimersByTime(7999)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).not.toContain('Still working')

    vi.advanceTimersByTime(1)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Still working')
  })

  it('clears its timer on unmount rather than leaking it', () => {
    const wrapper = mount(LoadingState, { props: { slowAfterMs: 1000 } })
    const clearSpy = vi.spyOn(global, 'clearTimeout')
    wrapper.unmount()
    expect(clearSpy).toHaveBeenCalled()
  })
})
