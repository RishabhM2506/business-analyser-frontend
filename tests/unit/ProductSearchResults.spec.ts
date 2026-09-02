import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ProductSearchResults from '@/components/search/ProductSearchResults.vue'
import type { RankedCandidateOut } from '@/types/generated'

const CANDIDATES: RankedCandidateOut[] = [
  {
    hs_code: '090111',
    description: 'Coffee, not roasted, not decaffeinated',
    relevance_score: 0.9,
  },
  { hs_code: '090121', description: 'Coffee, roasted, not decaffeinated', relevance_score: 0.6 },
  { hs_code: '090190', description: 'Coffee husks and skins', relevance_score: 0.2 },
]

function mountResults(candidates: RankedCandidateOut[] = CANDIDATES) {
  return mount(ProductSearchResults, { props: { candidates } })
}

describe('ProductSearchResults', () => {
  it('renders one option per candidate, plus a trailing "Something else" option, with code and description', () => {
    const wrapper = mountResults()
    const options = wrapper.findAll('[role="option"]')

    expect(options).toHaveLength(4) // 3 candidates + "Something else"
    expect(options[0]?.text()).toContain('090111')
    expect(options[0]?.text()).toContain('Coffee, not roasted, not decaffeinated')
    expect(options[3]?.text()).toContain('Something else')
  })

  it("renders each candidate's confidence as a rounded percentage", () => {
    const wrapper = mountResults()
    const options = wrapper.findAll('[role="option"]')

    expect(options[0]?.text()).toContain('90% match')
    expect(options[1]?.text()).toContain('60% match')
    expect(options[2]?.text()).toContain('20% match')
  })

  it('renders the listbox itself as focusable (tabindex 0), matching the standalone-listbox ARIA pattern', () => {
    const wrapper = mountResults()
    const listbox = wrapper.find('[role="listbox"]')
    expect(listbox.attributes('tabindex')).toBe('0')
  })

  it('ArrowDown on the listbox highlights the first option and sets aria-activedescendant', async () => {
    const wrapper = mountResults()
    const listbox = wrapper.find('[role="listbox"]')
    await listbox.trigger('keydown', { key: 'ArrowDown' })

    const options = wrapper.findAll('[role="option"]')
    expect(options[0]?.attributes('aria-selected')).toBe('true')
    expect(listbox.attributes('aria-activedescendant')).toBe(options[0]?.attributes('id'))
  })

  it('Enter on the highlighted option emits "select" with the full candidate', async () => {
    const wrapper = mountResults()
    const listbox = wrapper.find('[role="listbox"]')
    await listbox.trigger('keydown', { key: 'ArrowDown' })
    await listbox.trigger('keydown', { key: 'Enter' })

    const emitted = wrapper.emitted('select')
    expect(emitted).toHaveLength(1)
    expect(emitted?.[0]?.[0]).toMatchObject({ hs_code: '090111' })
  })

  it('clicking an option emits "select" with that candidate', async () => {
    const wrapper = mountResults()
    const options = wrapper.findAll('[role="option"]')
    await options[1]?.trigger('click')

    const emitted = wrapper.emitted('select')
    expect(emitted?.[0]?.[0]).toMatchObject({ hs_code: '090121' })
  })

  it('replacing the candidates list resets the active index', async () => {
    const wrapper = mountResults()
    const listbox = wrapper.find('[role="listbox"]')
    await listbox.trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.findAll('[role="option"]')[0]?.attributes('aria-selected')).toBe('true')

    await wrapper.setProps({
      candidates: [{ hs_code: '160100', description: 'Sausages', relevance_score: 0.8 }],
    })

    const options = wrapper.findAll('[role="option"]')
    expect(options).toHaveLength(2) // 1 candidate + "Something else"
    expect(options[0]?.attributes('aria-selected')).toBe('false')
  })

  it('renders only the "Something else" option for an empty candidate list', () => {
    const wrapper = mountResults([])
    const options = wrapper.findAll('[role="option"]')
    expect(options).toHaveLength(1)
    expect(options[0]?.text()).toContain('Something else')
  })

  it('clicking "Something else" emits "other", not "select"', async () => {
    const wrapper = mountResults()
    const options = wrapper.findAll('[role="option"]')
    // Distinct coordinates from the "clicking an option" test above, which
    // also fires a bare (0,0) click in this same test file — the shared
    // double-click navigation guard (router.ts's module-level
    // `navigationLock`, 400ms/40px) would otherwise mistake these two
    // separate tests' clicks for one rapid double-click.
    await options[3]?.trigger('click', { clientX: 999, clientY: 999 }) // the trailing "Something else" row

    expect(wrapper.emitted('other')).toHaveLength(1)
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('arrow-key navigation reaches "Something else" as the final item in the same listbox', async () => {
    const wrapper = mountResults()
    const listbox = wrapper.find('[role="listbox"]')
    for (let i = 0; i < 4; i += 1) {
      await listbox.trigger('keydown', { key: 'ArrowDown' })
    }

    const options = wrapper.findAll('[role="option"]')
    expect(options[3]?.attributes('aria-selected')).toBe('true')
    expect(listbox.attributes('aria-activedescendant')).toBe(options[3]?.attributes('id'))
  })

  it('Enter on the highlighted "Something else" option emits "other"', async () => {
    const wrapper = mountResults()
    const listbox = wrapper.find('[role="listbox"]')
    for (let i = 0; i < 4; i += 1) {
      await listbox.trigger('keydown', { key: 'ArrowDown' })
    }
    await listbox.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('other')).toHaveLength(1)
  })
})
