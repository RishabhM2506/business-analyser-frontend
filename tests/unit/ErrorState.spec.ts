import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ErrorState from '@/components/common/ErrorState.vue'

describe('ErrorState', () => {
  it('renders the message and a Retry button by default', () => {
    const wrapper = mount(ErrorState, { props: { message: 'Something broke.' } })
    expect(wrapper.text()).toContain('Something broke.')
    expect(wrapper.find('button').exists()).toBe(true)
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  })

  it('emits "retry" when the Retry button is clicked', async () => {
    const wrapper = mount(ErrorState, { props: { message: 'Failed.' } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('hides the Retry button when retryable is false, so a dead-end retry is never offered', () => {
    const wrapper = mount(ErrorState, { props: { message: 'Quota exceeded.', retryable: false } })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toContain('Quota exceeded.')
  })

  it('renders slot content for a supplementary action alongside the message', () => {
    const wrapper = mount(ErrorState, {
      props: { message: 'Invalid code.', retryable: false },
      slots: { default: '<a href="/categories">Choose a different category</a>' },
    })
    expect(wrapper.find('a').text()).toBe('Choose a different category')
  })
})
