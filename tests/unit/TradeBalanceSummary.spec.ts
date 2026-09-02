import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TradeBalanceSummary from '@/components/analysis/TradeBalanceSummary.vue'

import {
  FIXTURE_EMPTY_TRADE_BALANCE,
  FIXTURE_TRADE_BALANCE,
} from '../fixtures/tradeAnalysisResponse'

const YEARS = [2021, 2022, 2023, 2024, 2025]

describe('TradeBalanceSummary', () => {
  it('renders a signed value per year plus the cumulative total, verbatim from the backend', () => {
    const wrapper = mount(TradeBalanceSummary, {
      props: { tradeBalance: FIXTURE_TRADE_BALANCE, years: YEARS },
    })
    expect(wrapper.text()).toContain('-$750,000.00') // 2021
    expect(wrapper.text()).toContain('-$3,425,000.00') // cumulative
  })

  it('labels a negative cumulative balance as net importer', () => {
    const wrapper = mount(TradeBalanceSummary, {
      props: { tradeBalance: FIXTURE_TRADE_BALANCE, years: YEARS },
    })
    expect(wrapper.text()).toContain('net importer')
    expect(wrapper.text()).not.toContain('net exporter')
  })

  it('labels a positive cumulative balance as net exporter', () => {
    const wrapper = mount(TradeBalanceSummary, {
      props: {
        tradeBalance: { by_year: { 2021: 500 }, cumulative: 500 },
        years: [2021],
      },
    })
    expect(wrapper.text()).toContain('net exporter')
    expect(wrapper.text()).not.toContain('net importer')
  })

  it('renders "—" for a year with a null balance, never a fabricated number', () => {
    const wrapper = mount(TradeBalanceSummary, {
      props: { tradeBalance: FIXTURE_EMPTY_TRADE_BALANCE, years: YEARS },
    })
    // Every year is null in this fixture - the whole section falls back to
    // the explicit "not enough data" message rather than an all-dash table.
    expect(wrapper.text()).toContain('Not enough reported data')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('renders a partial table when only some years are null', () => {
    const wrapper = mount(TradeBalanceSummary, {
      props: {
        tradeBalance: { by_year: { 2021: 100, 2022: null }, cumulative: 100 },
        years: [2021, 2022],
      },
    })
    expect(wrapper.find('table').exists()).toBe(true)
    const cells = wrapper.findAll('tbody td')
    expect(cells[0]?.text()).toBe('+$100.00')
    expect(cells[1]?.text()).toBe('—')
  })
})
