import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import VirtualList from '@/components/common/VirtualList.vue'

const ITEM_COUNT = 1000
const ITEM_HEIGHT = 20
const MAX_HEIGHT = 200
const items = Array.from({ length: ITEM_COUNT }, (_, i) => i)

function mountList(extraProps: Record<string, unknown> = {}) {
  return mount(VirtualList, {
    props: {
      items,
      itemHeight: ITEM_HEIGHT,
      maxHeight: MAX_HEIGHT,
      listId: 'test-listbox',
      listAriaLabel: 'Test list',
      ...extraProps,
    },
    slots: {
      default:
        '<template #default="{ item, index }"><li class="row">{{ index }}:{{ item }}</li></template>',
    },
  })
}

describe('VirtualList', () => {
  it('renders far fewer DOM rows than the full item count', () => {
    const wrapper = mountList()
    const rows = wrapper.findAll('li.row')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThan(50)
  })

  it('renders the first items starting from index 0 before any scrolling', () => {
    const wrapper = mountList()
    const rows = wrapper.findAll('li.row')
    expect(rows[0]?.text()).toBe('0:0')
  })

  it('puts role/id/aria-label on the actual list element, not the scroll wrapper', () => {
    const wrapper = mountList({ listRole: 'listbox' })
    const list = wrapper.find('#test-listbox')
    expect(list.exists()).toBe(true)
    expect(list.attributes('role')).toBe('listbox')
    expect(list.attributes('aria-label')).toBe('Test list')
    expect(list.element.tagName).toBe('UL')
  })

  it('keeps role=option-style children as direct children of the list element (no wrapper divs in between)', () => {
    const wrapper = mountList()
    const list = wrapper.find('#test-listbox')
    // Every direct child of the semantic list element must be one of our
    // rendered <li> rows — nothing else may sit between listbox and option.
    for (const child of Array.from(list.element.children)) {
      expect(child.tagName).toBe('LI')
    }
  })

  it('shifts the rendered window forward after a scroll event', async () => {
    const wrapper = mountList()
    const viewport = wrapper.find('.virtual-list-viewport')
    Object.defineProperty(viewport.element, 'scrollTop', { value: 500, writable: true })
    await viewport.trigger('scroll')

    const rows = wrapper.findAll('li.row')
    const firstIndex = Number(rows[0]?.text().split(':')[0])
    // firstVisible = floor(500/20) = 25; default overscan 4 => startIndex 21.
    expect(firstIndex).toBe(21)
  })

  it('never renders an item beyond the provided array, even overscanning near the end', async () => {
    const wrapper = mountList()
    const viewport = wrapper.find('.virtual-list-viewport')
    Object.defineProperty(viewport.element, 'scrollTop', {
      value: ITEM_COUNT * ITEM_HEIGHT,
      writable: true,
    })
    await viewport.trigger('scroll')

    const rows = wrapper.findAll('li.row')
    const lastIndex = Number(rows[rows.length - 1]?.text().split(':')[0])
    expect(lastIndex).toBe(ITEM_COUNT - 1)
  })

  it('auto-scrolls the viewport when activeIndex moves outside the currently rendered window', async () => {
    const wrapper = mountList({ activeIndex: 0 })
    const viewport = wrapper.find('.virtual-list-viewport').element as HTMLElement
    expect(viewport.scrollTop).toBe(0)

    await wrapper.setProps({ activeIndex: 500 })

    // The active row's bottom (501 * 20 = 10020) must now be within view:
    // scrollTop should have advanced to bring it in range of the 200px viewport.
    expect(viewport.scrollTop).toBeGreaterThan(0)
    const rows = wrapper.findAll('li.row')
    const renderedIndexes = rows.map((row) => Number(row.text().split(':')[0]))
    expect(renderedIndexes).toContain(500)
  })

  it('shrinks the viewport height to fit when there are fewer items than maxHeight allows', () => {
    const wrapper = mount(VirtualList, {
      props: { items: [1, 2, 3], itemHeight: ITEM_HEIGHT, maxHeight: MAX_HEIGHT },
      slots: {
        default: '<template #default="{ item }"><li class="row">{{ item }}</li></template>',
      },
    })
    const viewport = wrapper.find('.virtual-list-viewport')
    expect(viewport.attributes('style')).toContain('max-height: 60px')
  })

  it('renders zero rows for an empty items array without throwing', () => {
    const wrapper = mount(VirtualList, {
      props: { items: [], itemHeight: ITEM_HEIGHT, maxHeight: MAX_HEIGHT },
      slots: {
        default: '<template #default="{ item }"><li class="row">{{ item }}</li></template>',
      },
    })
    expect(wrapper.findAll('li.row')).toHaveLength(0)
  })
})
