import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CategorySearch from '@/components/hs-picker/CategorySearch.vue'

import { FIXTURE_TAXONOMY } from '../fixtures/hsTaxonomy'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_TAXONOMY }),
  )
})

async function mountLoaded() {
  const wrapper = mount(CategorySearch)
  await flushPromises()
  return wrapper
}

describe('CategorySearch', () => {
  it('renders a labeled search input', async () => {
    const wrapper = await mountLoaded()
    const input = wrapper.find('input[role="combobox"]')
    expect(input.exists()).toBe(true)
    expect(wrapper.find('label').text()).toContain('Search HS categories')
  })

  it('sets aria-expanded to false and hides the results list before the input is focused', async () => {
    const wrapper = await mountLoaded()
    const input = wrapper.find('input')
    expect(input.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
  })

  it('opening the input (focus) shows the full, sorted category list when the query is empty', async () => {
    const wrapper = await mountLoaded()
    const input = wrapper.find('input')
    await input.trigger('focus')

    const options = wrapper.findAll('[role="option"]')
    expect(options).toHaveLength(2) // two level-2 categories in the fixture
    expect(input.attributes('aria-expanded')).toBe('true')
  })

  it('typing filters results to matching categories only', async () => {
    const wrapper = await mountLoaded()
    const input = wrapper.find('input')
    await input.trigger('focus')
    await input.setValue('meat')
    await flushPromises()

    const options = wrapper.findAll('[role="option"]')
    expect(options).toHaveLength(1)
    expect(options[0]?.text()).toContain('Meat, fish etc')
  })

  it('shows a "no matches" message for a query that matches nothing', async () => {
    const wrapper = await mountLoaded()
    const input = wrapper.find('input')
    await input.trigger('focus')
    await input.setValue('zzz_nonexistent')
    await flushPromises()

    expect(wrapper.findAll('[role="option"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('No categories match')
  })

  it('ArrowDown opens the list (if closed) and highlights the first option', async () => {
    const wrapper = await mountLoaded()
    await wrapper.find('input').trigger('keydown', { key: 'ArrowDown' })

    const options = wrapper.findAll('[role="option"]')
    expect(options[0]?.attributes('aria-selected')).toBe('true')
    expect(wrapper.find('input').attributes('aria-activedescendant')).toBe(
      options[0]?.attributes('id'),
    )
  })

  it('ArrowDown/ArrowUp move the highlighted option without wrapping past the ends', async () => {
    const wrapper = await mountLoaded()
    const input = wrapper.find('input')
    await input.trigger('focus')

    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    let options = wrapper.findAll('[role="option"]')
    expect(options[1]?.attributes('aria-selected')).toBe('true')

    // One more ArrowDown past the last (2nd, index 1) option should clamp, not wrap to index 0.
    await input.trigger('keydown', { key: 'ArrowDown' })
    options = wrapper.findAll('[role="option"]')
    expect(options[1]?.attributes('aria-selected')).toBe('true')
    expect(options[0]?.attributes('aria-selected')).toBe('false')
  })

  it('Enter selects the highlighted option and emits "select" with the full entry', async () => {
    const wrapper = await mountLoaded()
    const input = wrapper.find('input')
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })

    const emitted = wrapper.emitted('select')
    expect(emitted).toHaveLength(1)
    expect(emitted?.[0]?.[0]).toMatchObject({ hs_code: '01', description: 'Animals; live' })
  })

  it('clicking an option selects it and emits "select"', async () => {
    const wrapper = await mountLoaded()
    await wrapper.find('input').trigger('focus')
    const options = wrapper.findAll('[role="option"]')
    await options[1]?.trigger('click')

    const emitted = wrapper.emitted('select')
    expect(emitted).toHaveLength(1)
    expect(emitted?.[0]?.[0]).toMatchObject({ hs_code: '16' })
  })

  it('Escape closes the list', async () => {
    const wrapper = await mountLoaded()
    const input = wrapper.find('input')
    await input.trigger('focus')
    expect(wrapper.find('[role="listbox"]').exists()).toBe(true)

    await input.trigger('keydown', { key: 'Escape' })
    expect(input.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
  })

  it('keeps a real long description fully intact in the DOM (M12: CSS-only truncation, never a lossy string truncation)', async () => {
    // Regression test for Phase 4 finding M12/Frontend-Reviewer#1 — see
    // ItemList.spec.ts's identical-in-spirit test for the full rationale.
    // This exact 233-char description is a real row from the checked-in
    // public/hs-taxonomy.json (hs_code 34) — the longest level-2 (category)
    // description in the real dataset.
    const LONG_DESCRIPTION =
      'Soap, organic surface-active agents; washing, lubricating, polishing or scouring preparations; artificial or prepared waxes, candles and similar articles, modelling pastes, dental waxes and dental preparations with a basis of plaster'
    expect(LONG_DESCRIPTION.length).toBeGreaterThan(200)
    vi.resetModules()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          {
            hs_code: '34',
            description: LONG_DESCRIPTION,
            level: 2,
            section: 'VI',
            parent: 'TOTAL',
          },
        ],
      }),
    )
    const { default: FreshCategorySearch } =
      await import('@/components/hs-picker/CategorySearch.vue')
    const wrapper = mount(FreshCategorySearch)
    await flushPromises()
    await wrapper.find('input').trigger('focus')

    const desc = wrapper.find('.category-search__desc')
    expect(desc.text()).toBe(LONG_DESCRIPTION)
    expect(desc.attributes('title')).toBe(LONG_DESCRIPTION)
  })

  it('renders a category description containing markup as inert escaped text, never as executed HTML', async () => {
    // Needs genuinely fresh module state: useHsTaxonomy's singleton would
    // otherwise still be holding the fixture loaded by an earlier test in
    // this file and skip re-fetching, per its own idempotent-load guard.
    vi.resetModules()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          {
            hs_code: '77',
            description: '<img src=x onerror=alert(1)>Suspicious category',
            level: 2,
            section: 'I',
            parent: 'TOTAL',
          },
        ],
      }),
    )
    const { default: FreshCategorySearch } =
      await import('@/components/hs-picker/CategorySearch.vue')
    const wrapper = mount(FreshCategorySearch)
    await flushPromises()
    await wrapper.find('input').trigger('focus')

    // The markup must never be parsed into a real element…
    expect(wrapper.find('img').exists()).toBe(false)
    // …it must show up as literal, escaped text content instead.
    expect(wrapper.find('[role="option"]').text()).toContain(
      '<img src=x onerror=alert(1)>Suspicious category',
    )
  })
})
