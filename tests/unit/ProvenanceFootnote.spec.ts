import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ProvenanceFootnote from '@/components/analysis/ProvenanceFootnote.vue'

import { FIXTURE_PROVENANCE } from '../fixtures/tradeAnalysisResponse'

describe('ProvenanceFootnote', () => {
  it('renders the source, currency, and prompt version verbatim from the structured data', () => {
    const wrapper = mount(ProvenanceFootnote, { props: { provenance: FIXTURE_PROVENANCE } })
    expect(wrapper.text()).toContain('UN Comtrade (comtradeapi.un.org)')
    expect(wrapper.text()).toContain('USD')
    expect(wrapper.text()).toContain('v1.0.0')
  })

  it('explicitly surfaces calendar-year vs. Indian fiscal-year to the user, not only in code comments', () => {
    const wrapper = mount(ProvenanceFootnote, { props: { provenance: FIXTURE_PROVENANCE } })
    const text = wrapper.text()
    expect(text).toContain('Calendar year')
    expect(text).toContain('fiscal year')
  })

  it('renders the retrieved-at timestamp in a <time> element carrying the original ISO datetime', () => {
    const wrapper = mount(ProvenanceFootnote, { props: { provenance: FIXTURE_PROVENANCE } })
    const time = wrapper.find('time')
    expect(time.exists()).toBe(true)
    expect(time.attributes('datetime')).toBe('2026-08-10T12:00:00Z')
    // Some human-readable rendering of the same instant, not the raw ISO string dumped as-is.
    expect(time.text()).not.toBe('')
    expect(time.text()).not.toBe(FIXTURE_PROVENANCE.retrieved_at)
  })

  it('falls back to the raw value rather than crashing or showing "Invalid Date" for an unparsable timestamp', () => {
    const wrapper = mount(ProvenanceFootnote, {
      props: { provenance: { ...FIXTURE_PROVENANCE, retrieved_at: 'not-a-real-date' } },
    })
    expect(wrapper.find('time').text()).toBe('not-a-real-date')
    expect(wrapper.text()).not.toContain('Invalid Date')
  })
})
