import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppButton from '@/components/common/AppButton.vue'

describe('AppButton', () => {
  it('renders its slot content', () => {
    const wrapper = mount(AppButton, { slots: { default: 'Click me' } })
    expect(wrapper.text()).toBe('Click me')
  })

  it('emits a click event when clicked', async () => {
    const wrapper = mount(AppButton, { slots: { default: 'Go' } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('defaults to the primary variant and applies the requested variant class', () => {
    const primary = mount(AppButton, { slots: { default: 'Go' } })
    expect(primary.classes()).toContain('app-button--primary')

    const secondary = mount(AppButton, {
      props: { variant: 'secondary' },
      slots: { default: 'Go' },
    })
    expect(secondary.classes()).toContain('app-button--secondary')
  })

  it('renders as a disabled native button when disabled is set', () => {
    const wrapper = mount(AppButton, { props: { disabled: true }, slots: { default: 'Go' } })
    expect(wrapper.attributes('disabled')).toBeDefined()
  })
})
