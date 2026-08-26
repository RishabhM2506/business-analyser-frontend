import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import QueryControls from '@/components/common/QueryControls.vue'

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message)
  return value
}

function inputs(wrapper: ReturnType<typeof mount>) {
  const all = wrapper.findAll('input[type="number"]')
  return {
    years: required(all[0], 'expected a years input'),
    topN: required(all[1], 'expected a top_n input'),
  }
}

describe('QueryControls', () => {
  it('renders both inputs empty (showing the "Default" placeholder) when years/topN are null', () => {
    const wrapper = mount(QueryControls, {
      props: { years: null, topN: null, maxYears: 8 },
    })
    const { years, topN } = inputs(wrapper)
    expect((years.element as HTMLInputElement).value).toBe('')
    expect((topN.element as HTMLInputElement).value).toBe('')
  })

  it('renders the provided years/topN values', () => {
    const wrapper = mount(QueryControls, {
      props: { years: 3, topN: 15, maxYears: 8 },
    })
    const { years, topN } = inputs(wrapper)
    expect((years.element as HTMLInputElement).value).toBe('3')
    expect((topN.element as HTMLInputElement).value).toBe('15')
  })

  it('emits update:years / update:topN as the user types, never guessing a default client-side', async () => {
    const wrapper = mount(QueryControls, {
      props: { years: null, topN: null, maxYears: 8 },
    })
    const { years, topN } = inputs(wrapper)

    await years.setValue('4')
    expect(wrapper.emitted('update:years')?.at(-1)).toEqual([4])

    await topN.setValue('12')
    expect(wrapper.emitted('update:topN')?.at(-1)).toEqual([12])
  })

  it('emits null (not NaN or 0) when a field is cleared back to empty', async () => {
    const wrapper = mount(QueryControls, {
      props: { years: 5, topN: 10, maxYears: 8 },
    })
    const { years } = inputs(wrapper)
    await years.setValue('')
    expect(wrapper.emitted('update:years')?.at(-1)).toEqual([null])
  })

  it('emits "apply" on form submit, not on every keystroke', async () => {
    const wrapper = mount(QueryControls, {
      props: { years: null, topN: null, maxYears: 8 },
    })
    const { years } = inputs(wrapper)
    await years.setValue('4')
    expect(wrapper.emitted('apply')).toBeUndefined()

    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('apply')).toHaveLength(1)
  })

  it('"Reset to defaults" clears both fields to null and applies immediately', async () => {
    const wrapper = mount(QueryControls, {
      props: { years: 5, topN: 10, maxYears: 8 },
    })
    const resetButton = required(
      wrapper.findAll('button').find((b) => b.text().includes('Reset to defaults')),
      'expected a Reset to defaults button',
    )

    await resetButton.trigger('click')

    expect(wrapper.emitted('update:years')?.at(-1)).toEqual([null])
    expect(wrapper.emitted('update:topN')?.at(-1)).toEqual([null])
    expect(wrapper.emitted('apply')).toHaveLength(1)
  })

  it('applies min/max bounds from props to the underlying number inputs', () => {
    const wrapper = mount(QueryControls, {
      props: { years: null, topN: null, maxYears: 8, minTopN: 3, maxTopN: 25 },
    })
    const { years, topN } = inputs(wrapper)
    expect(years.attributes('min')).toBe('1')
    expect(years.attributes('max')).toBe('8')
    expect(topN.attributes('min')).toBe('3')
    expect(topN.attributes('max')).toBe('25')
  })

  it('disables both inputs and buttons when disabled is true', () => {
    const wrapper = mount(QueryControls, {
      props: { years: null, topN: null, maxYears: 8, disabled: true },
    })
    const { years, topN } = inputs(wrapper)
    expect(years.attributes('disabled')).toBeDefined()
    expect(topN.attributes('disabled')).toBeDefined()
    for (const button of wrapper.findAll('button')) {
      expect(button.attributes('disabled')).toBeDefined()
    }
  })
})
