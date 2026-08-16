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

  it('keeps a real long description fully intact in the DOM (M12: CSS-only truncation, never a lossy string truncation)', async () => {
    // Regression test for Phase 4 finding M12/Frontend-Reviewer#1: VirtualList's
    // fixed-row-height math depends on `.item-list__desc` staying a single
    // visual line (enforced by CSS now — white-space:nowrap + ellipsis), but
    // that must never come from truncating the underlying string itself
    // (missing/altered data would violate the "never interpolated, never
    // silently altered" rule). This exact 255-char description is a real row
    // from the checked-in public/hs-taxonomy.json (hs_code 293333) — the
    // longest level-6 description in the real dataset, not a short test
    // fixture like the other cases in this file.
    //
    // Needs genuinely fresh module state (vi.resetModules() + a dynamic
    // re-import), same as CategorySearch.spec.ts's XSS test: useHsTaxonomy's
    // singleton would otherwise still be holding FIXTURE_TAXONOMY from an
    // earlier test in this file and skip re-fetching, per its own
    // idempotent-load guard — the mock below would never actually be used.
    const LONG_DESCRIPTION =
      'Heterocyclic compounds; containing an unfused pyridine ring (whether or not hydrogenated) in the structure, alfentanil (INN), anileridine (INN), bezitramide (INN), bromazepam (INN), carfentanil (INN), difenoxin (INN), diphenoxylate (INN), dipipanone (INN)'
    expect(LONG_DESCRIPTION.length).toBeGreaterThan(200)
    vi.resetModules()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          { hs_code: '01', description: 'Animals; live', level: 2, section: 'I', parent: 'TOTAL' },
          {
            hs_code: '010199',
            description: LONG_DESCRIPTION,
            level: 6,
            section: 'I',
            parent: '0101',
          },
        ],
      }),
    )
    const { default: FreshItemList } = await import('@/components/hs-picker/ItemList.vue')
    const wrapper = mount(FreshItemList, { props: { categoryCode: '01' } })
    await flushPromises()

    const desc = wrapper.find('.item-list__desc')
    expect(desc.text()).toBe(LONG_DESCRIPTION)
    // The full text is also available via `title` (hover) since the visible
    // row itself is now intentionally single-line/ellipsized.
    expect(desc.attributes('title')).toBe(LONG_DESCRIPTION)
  })

  describe('search (M24/PBO-06)', () => {
    it('typing a query filters the item list to matching results only', async () => {
      const wrapper = await mountLoaded('01')
      expect(wrapper.findAll('[role="option"]')).toHaveLength(2)

      // Only 010129 ("...other than pure-bred breeding animals") contains "other".
      const searchInput = wrapper.find('input[role="searchbox"]')
      await searchInput.setValue('other')
      await flushPromises()

      const options = wrapper.findAll('[role="option"]')
      expect(options).toHaveLength(1)
      expect(options[0]?.text()).toContain('010129')
      expect(wrapper.text()).toContain('1 item')
      expect(wrapper.text()).toContain('of 2')
    })

    it('shows a "no items match" message for a query that matches nothing, distinct from EmptyState', async () => {
      const wrapper = await mountLoaded('01')
      const searchInput = wrapper.find('input[role="searchbox"]')
      await searchInput.setValue('zzz_no_such_item_zzz')
      await flushPromises()

      expect(wrapper.findAll('[role="option"]')).toHaveLength(0)
      expect(wrapper.text()).toContain('No items match')
      // Distinct from the "genuinely empty category" EmptyState message.
      expect(wrapper.text()).not.toContain('No items found in this category')
    })

    it('clearing the query restores the full item list', async () => {
      const wrapper = await mountLoaded('01')
      const searchInput = wrapper.find('input[role="searchbox"]')
      await searchInput.setValue('other')
      await flushPromises()
      expect(wrapper.findAll('[role="option"]')).toHaveLength(1)

      await searchInput.setValue('')
      await flushPromises()
      expect(wrapper.findAll('[role="option"]')).toHaveLength(2)
    })

    it('switching categoryCode clears any leftover search query from the previous category', async () => {
      const wrapper = await mountLoaded('01')
      const searchInput = wrapper.find('input[role="searchbox"]')
      await searchInput.setValue('other')
      await flushPromises()
      expect(wrapper.findAll('[role="option"]')).toHaveLength(1)

      await wrapper.setProps({ categoryCode: '16' })
      await flushPromises()

      expect((wrapper.find('input[role="searchbox"]').element as HTMLInputElement).value).toBe('')
      expect(wrapper.findAll('[role="option"]')).toHaveLength(1) // the one item in category 16
    })
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
