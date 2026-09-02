import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DutyVerificationTable from '@/components/report/DutyVerificationTable.vue'
import type { DutyComponentEvidence, LandedCostResult } from '@/types/generated'

function evidence(overrides: Partial<DutyComponentEvidence> = {}): DutyComponentEvidence {
  return {
    component: 'BCD',
    verification_status: 'NOT_VERIFIED',
    value_pct: null,
    source_authority: null,
    source_reference: null,
    source_url: null,
    verified_date: null,
    notes: null,
    conflicting_candidates: null,
    ...overrides,
  }
}

function landedCost(overrides: Partial<LandedCostResult> = {}): LandedCostResult {
  return {
    is_complete: true,
    landed_cost_inr_paise_per_kg: 12000,
    partial_landed_cost_inr_paise_per_kg: 12000,
    excluded_components: [],
    components: {
      BCD: evidence({ component: 'BCD', verification_status: 'VERIFIED', value_pct: '20.000' }),
    },
    ...overrides,
  }
}

describe('DutyVerificationTable', () => {
  it('renders "Expired (historical)" for an EXPIRED component, distinct from Verified', () => {
    const wrapper = mount(DutyVerificationTable, {
      props: {
        landedCost: landedCost({
          components: {
            BCD: evidence({
              component: 'BCD',
              verification_status: 'EXPIRED',
              value_pct: '15.000',
              verified_date: '2020-01-01',
            }),
          },
        }),
        asOfPeriod: '2023',
      },
    })
    expect(wrapper.text()).toContain('Expired (historical)')
    expect(wrapper.text()).toContain('15%')
  })

  it('renders "Conflicting sources" for a CONFLICTING component and lists each real candidate rate/source, never picking one silently', () => {
    const wrapper = mount(DutyVerificationTable, {
      props: {
        landedCost: landedCost({
          is_complete: false,
          excluded_components: ['BCD'],
          components: {
            BCD: evidence({
              component: 'BCD',
              verification_status: 'CONFLICTING',
              value_pct: null,
              conflicting_candidates: [
                {
                  value_pct: '10.000',
                  source_authority: 'ICEGATE Trade Guide',
                  source_reference: 'Live GET, 2026-08-20',
                  source_url: 'https://www.icegate.gov.in/one',
                },
                {
                  value_pct: '12.500',
                  source_authority: 'CBIC Notification 45/2023',
                  source_reference: 'PDF, para 3',
                  source_url: null,
                },
              ],
            }),
          },
        }),
        asOfPeriod: null,
      },
    })
    expect(wrapper.text()).toContain('Conflicting sources')
    // The unverified row itself must never render a fabricated percentage.
    expect(wrapper.findAll('.duty__rate')[0]?.text()).toBe('—')
    // Both real candidates, not just one silently chosen.
    expect(wrapper.text()).toContain('Sources disagree on BCD')
    expect(wrapper.text()).toContain('2 conflicting rates reported')
    expect(wrapper.text()).toContain('10%')
    expect(wrapper.text()).toContain('12.5%')
    expect(wrapper.text()).toContain('ICEGATE Trade Guide')
    expect(wrapper.text()).toContain('CBIC Notification 45/2023')
    expect(wrapper.text()).toContain('Live GET, 2026-08-20')
    const link = wrapper.find('.duty__conflict-source a')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('https://www.icegate.gov.in/one')
  })

  it('renders no conflict detail row when conflicting_candidates is null or empty', () => {
    const wrapper = mount(DutyVerificationTable, {
      props: {
        landedCost: landedCost({
          components: {
            BCD: evidence({ component: 'BCD', verification_status: 'NOT_VERIFIED' }),
          },
        }),
        asOfPeriod: null,
      },
    })
    expect(wrapper.find('.duty__conflict-row').exists()).toBe(false)
  })

  it('singularizes "1 conflicting rate" for exactly one candidate', () => {
    const wrapper = mount(DutyVerificationTable, {
      props: {
        landedCost: landedCost({
          components: {
            BCD: evidence({
              component: 'BCD',
              verification_status: 'CONFLICTING',
              conflicting_candidates: [
                {
                  value_pct: '10.000',
                  source_authority: 'ICEGATE',
                  source_reference: 'ref',
                  source_url: null,
                },
              ],
            }),
          },
        }),
        asOfPeriod: null,
      },
    })
    expect(wrapper.text()).toContain('1 conflicting rate reported')
    expect(wrapper.text()).not.toContain('1 conflicting rates')
  })
})
