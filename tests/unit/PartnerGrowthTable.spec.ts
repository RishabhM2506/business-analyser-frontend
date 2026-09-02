import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PartnerGrowthTable from '@/components/report/PartnerGrowthTable.vue'
import type { AnnualSeriesYear } from '@/types/generated'

function annualYear(partners: AnnualSeriesYear['partners']): AnnualSeriesYear {
  return {
    year: 2023,
    flow: 'import',
    total_inr_paise: 1000,
    status: 'OK',
    partners,
    all_other_partners: { value_inr_paise: 0, status: 'OK' },
  }
}

describe('PartnerGrowthTable', () => {
  it('renders nothing when no partner has a computable metric', () => {
    const annualSeries = [
      annualYear([
        {
          rank: 1,
          country: 'Türkiye',
          partner_country_code: '792',
          value_inr_paise: 100,
          status: 'OK',
        },
      ]),
    ]
    const wrapper = mount(PartnerGrowthTable, {
      props: { annualSeries, cagrByPartner: { '792': null }, volatilityByPartner: { '792': null } },
    })
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('joins cagr_by_partner/volatility_by_partner against the resolved country name', () => {
    const annualSeries = [
      annualYear([
        {
          rank: 1,
          country: 'Türkiye',
          partner_country_code: '792',
          value_inr_paise: 100,
          status: 'OK',
        },
      ]),
    ]
    const wrapper = mount(PartnerGrowthTable, {
      props: {
        annualSeries,
        cagrByPartner: { '792': 0.2 },
        volatilityByPartner: { '792': 0.5 },
      },
    })
    expect(wrapper.text()).toContain('Türkiye')
    expect(wrapper.text()).toContain('+20.0%')
    expect(wrapper.text()).toContain('0.50')
  })

  it('shows the High badge only above the volatility threshold', () => {
    const annualSeries = [
      annualYear([
        {
          rank: 1,
          country: 'Spiky',
          partner_country_code: '1',
          value_inr_paise: 100,
          status: 'OK',
        },
        {
          rank: 2,
          country: 'Steady',
          partner_country_code: '2',
          value_inr_paise: 100,
          status: 'OK',
        },
      ]),
    ]
    const wrapper = mount(PartnerGrowthTable, {
      props: {
        annualSeries,
        cagrByPartner: { '1': null, '2': null },
        volatilityByPartner: { '1': 1.5, '2': 0.3 },
      },
    })
    const rows = wrapper.findAll('tbody tr')
    // Sorted by volatility descending - Spiky (1.5) first.
    expect(rows[0]?.text()).toContain('Spiky')
    expect(rows[0]?.find('.growth__badge').exists()).toBe(true)
    expect(rows[1]?.text()).toContain('Steady')
    expect(rows[1]?.find('.growth__badge').exists()).toBe(false)
  })

  it('excludes a partner with both metrics null even if others qualify', () => {
    const annualSeries = [
      annualYear([
        {
          rank: 1,
          country: 'HasData',
          partner_country_code: '1',
          value_inr_paise: 100,
          status: 'OK',
        },
        {
          rank: 2,
          country: 'NoData',
          partner_country_code: '2',
          value_inr_paise: 100,
          status: 'OK',
        },
      ]),
    ]
    const wrapper = mount(PartnerGrowthTable, {
      props: {
        annualSeries,
        cagrByPartner: { '1': 0.1, '2': null },
        volatilityByPartner: { '1': null, '2': null },
      },
    })
    expect(wrapper.text()).toContain('HasData')
    expect(wrapper.text()).not.toContain('NoData')
  })
})
