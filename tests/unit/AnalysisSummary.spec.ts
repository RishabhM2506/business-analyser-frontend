import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AnalysisSummary from '@/components/analysis/AnalysisSummary.vue'

describe('AnalysisSummary', () => {
  it('renders the item description under a "What this item is" heading', () => {
    const wrapper = mount(AnalysisSummary, {
      props: { itemDescription: 'A live horse.', analyticalSummary: 'Imports rose steadily.' },
    })
    const headings = wrapper.findAll('h2').map((h) => h.text())
    expect(headings).toContain('What this item is')
    expect(wrapper.text()).toContain('A live horse.')
  })

  it('renders the analytical summary under an "Analysis" heading', () => {
    const wrapper = mount(AnalysisSummary, {
      props: { itemDescription: 'A live horse.', analyticalSummary: 'Imports rose steadily.' },
    })
    const headings = wrapper.findAll('h2').map((h) => h.text())
    expect(headings).toContain('Analysis')
    expect(wrapper.text()).toContain('Imports rose steadily.')
  })

  it('splits multi-paragraph text into separate <p> elements, not one blob', () => {
    const wrapper = mount(AnalysisSummary, {
      props: {
        itemDescription: 'First paragraph.\n\nSecond paragraph.',
        analyticalSummary: 'Summary.',
      },
    })
    const paragraphs = wrapper.findAll('p').map((p) => p.text())
    expect(paragraphs).toContain('First paragraph.')
    expect(paragraphs).toContain('Second paragraph.')
  })

  it('omits a block entirely when its text is empty rather than rendering an empty heading', () => {
    const wrapper = mount(AnalysisSummary, {
      props: { itemDescription: '', analyticalSummary: 'Summary only.' },
    })
    const headings = wrapper.findAll('h2').map((h) => h.text())
    expect(headings).not.toContain('What this item is')
    expect(headings).toContain('Analysis')
  })

  it('renders model-authored markup as inert escaped text, never as executed HTML or interpreted markdown', () => {
    const wrapper = mount(AnalysisSummary, {
      props: {
        itemDescription: '<img src=x onerror=alert(1)> and **bold** and # heading',
        analyticalSummary: 'Summary.',
      },
    })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('strong').exists()).toBe(false)
    expect(wrapper.find('h1').exists()).toBe(false)
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)> and **bold** and # heading')
  })
})
