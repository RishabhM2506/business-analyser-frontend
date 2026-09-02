import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import LlmDatapointNote from '@/components/report/LlmDatapointNote.vue'
import type { LlmDatapointFact } from '@/types/generated'

const DATAPOINT: LlmDatapointFact = {
  field_name: 'mandi_price',
  effective_period: '2026-08',
  value: { modal_price_inr_paise_per_qtl: 850000, market: 'Nashik' },
  source_authority: 'Test Authority',
  source_reference: 'Test market bulletin',
  source_url: 'https://example.test/bulletin',
  verified_date: '2026-09-02',
}

describe('LlmDatapointNote', () => {
  it('renders nothing when there are no datapoints', () => {
    const wrapper = mount(LlmDatapointNote, { props: { datapoints: [] } })
    expect(wrapper.text()).toBe('')
  })

  it('renders the citation, values, and the "not independently verified" badge', () => {
    const wrapper = mount(LlmDatapointNote, { props: { datapoints: [DATAPOINT] } })
    expect(wrapper.text()).toContain('Cited, not independently verified')
    expect(wrapper.text()).toContain('850000')
    expect(wrapper.text()).toContain('Nashik')
    expect(wrapper.text()).toContain('Test Authority')
    expect(wrapper.text()).toContain('Test market bulletin')
    expect(wrapper.text()).toContain('2026-08')
  })

  it('links the source_authority to source_url when present', () => {
    const wrapper = mount(LlmDatapointNote, { props: { datapoints: [DATAPOINT] } })
    const link = wrapper.find('a')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('https://example.test/bulletin')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
  })

  it('renders the authority as plain text, no link, when source_url is null', () => {
    const wrapper = mount(LlmDatapointNote, {
      props: { datapoints: [{ ...DATAPOINT, source_url: null }] },
    })
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.text()).toContain('Test Authority')
  })

  it('renders multiple entries, each with its own citation', () => {
    const second: LlmDatapointFact = {
      ...DATAPOINT,
      effective_period: '2026-07',
      source_reference: 'An earlier bulletin',
    }
    const wrapper = mount(LlmDatapointNote, { props: { datapoints: [DATAPOINT, second] } })
    expect(wrapper.findAll('.llm-note__entry')).toHaveLength(2)
    expect(wrapper.text()).toContain('Test market bulletin')
    expect(wrapper.text()).toContain('An earlier bulletin')
  })
})
