import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ItemList from '@/components/hs-picker/ItemList.vue'

import { FIXTURE_TAXONOMY } from '../fixtures/hsTaxonomy'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_TAXONOMY }),
  )
})

async function mountLoaded(categoryCode: string) {
  const wrapper = mount(ItemList, { props: { categoryCode } })
  await flushPromises()
  return wrapper
}

describe('ItemList', () => {
  it('lists only the level-6 items nested under the given category', async () => {
    const wrapper = await mountLoaded('01')
    const options = wrapper.findAll('[role="option"]')
    expect(options).toHaveLength(2)
    expect(options[0]?.text()).toContain('010121')
    expect(options[1]?.text()).toContain('010129')
  })

  it('shows an item count', async () => {
    const wrapper = await mountLoaded('01')
    expect(wrapper.text()).toContain('2 items')
  })

  it('shows an EmptyState for a category with no items', async () => {
    const wrapper = await mountLoaded('99')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('No items found')
  })

  it('renders the listbox itself as focusable (tabindex 0), matching the standalone-listbox ARIA pattern', async () => {
    const wrapper = await mountLoaded('01')
    const listbox = wrapper.find('[role="listbox"]')
    expect(listbox.attributes('tabindex')).toBe('0')
  })

  it('ArrowDown on the listbox highlights the first option and sets aria-activedescendant on the listbox itself', async () => {
    const wrapper = await mountLoaded('01')
    const listbox = wrapper.find('[role="listbox"]')
    await listbox.trigger('keydown', { key: 'ArrowDown' })

    const options = wrapper.findAll('[role="option"]')
    expect(options[0]?.attributes('aria-selected')).toBe('true')
    expect(listbox.attributes('aria-activedescendant')).toBe(options[0]?.attributes('id'))
  })

  it('Enter on the highlighted option emits "select" with the full entry', async () => {
    const wrapper = await mountLoaded('01')
    const listbox = wrapper.find('[role="listbox"]')
    await listbox.trigger('keydown', { key: 'ArrowDown' })
    await listbox.trigger('keydown', { key: 'Enter' })

    const emitted = wrapper.emitted('select')
    expect(emitted).toHaveLength(1)
    expect(emitted?.[0]?.[0]).toMatchObject({ hs_code: '010121' })
  })

  it('clicking an option emits "select" with that item', async () => {
    const wrapper = await mountLoaded('01')
    const options = wrapper.findAll('[role="option"]')
    await options[1]?.trigger('click')

    const emitted = wrapper.emitted('select')
    expect(emitted?.[0]?.[0]).toMatchObject({ hs_code: '010129' })
  })

  it('switching categoryCode (e.g. user navigates back and picks a different category) refreshes the list', async () => {
    const wrapper = await mountLoaded('01')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(2)

    await wrapper.setProps({ categoryCode: '16' })
    await flushPromises()

    const options = wrapper.findAll('[role="option"]')
    expect(options).toHaveLength(1)
    expect(options[0]?.text()).toContain('160100')
  })
})
