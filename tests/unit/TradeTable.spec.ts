import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TradeTable from '@/components/analysis/TradeTable.vue'
import type { TradeTable as TradeTableType } from '@/types/generated'

import { FIXTURE_EMPTY_TRADE_TABLE, FIXTURE_IMPORTS_TABLE } from '../fixtures/tradeAnalysisResponse'

describe('TradeTable', () => {
  it('renders one row per country and the title as a heading', () => {
    const wrapper = mount(TradeTable, { props: { title: 'Imports', table: FIXTURE_IMPORTS_TABLE } })
    expect(wrapper.find('h3').text()).toBe('Imports')
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
  })

  it('renders rows in rank order even when the input array is not pre-sorted', () => {
    const shuffled: TradeTableType = {
      ...FIXTURE_IMPORTS_TABLE,
      rows: [...FIXTURE_IMPORTS_TABLE.rows].reverse(), // rank 2 (Germany) first in the array
    }
    const wrapper = mount(TradeTable, { props: { title: 'Imports', table: shuffled } })
    const rows = wrapper.findAll('tbody tr')
    expect(rows[0]?.text()).toContain('United States') // rank 1, regardless of array order
    expect(rows[1]?.text()).toContain('Germany')
  })

  it('renders a null values_by_year cell as the missing-data marker "—", never blank and never a guessed number', () => {
    const wrapper = mount(TradeTable, { props: { title: 'Imports', table: FIXTURE_IMPORTS_TABLE } })
    const rows = wrapper.findAll('tbody tr')
    const germanyRow = rows.find((row) => row.text().includes('Germany'))
    if (!germanyRow) {
      throw new Error('Expected to find a rendered row for Germany')
    }
    const cells = germanyRow.findAll('td')
    // Columns: rank, country, 2021, 2022, 2023, 2024, 2025, 5yr total.
    expect(cells[4]?.text()).toBe('—')
    // Neighboring real cells must still show real formatted numbers, not also blanked out.
    expect(cells[3]?.text()).toBe('$310,000.00')
    expect(cells[5]?.text()).toBe('$290,000.00')
  })

  it('formats a present numeric value as grouped USD currency, unchanged from the source number', () => {
    const wrapper = mount(TradeTable, { props: { title: 'Imports', table: FIXTURE_IMPORTS_TABLE } })
    const rows = wrapper.findAll('tbody tr')
    const usRow = rows.find((row) => row.text().includes('United States'))
    if (!usRow) {
      throw new Error('Expected to find a rendered row for United States')
    }
    const cells = usRow.findAll('td')
    expect(cells[2]?.text()).toBe('$500,000.00') // 2021
    expect(cells[7]?.text()).toBe('$2,505,000.00') // 5-yr total (cumulative_5yr, given verbatim)
  })

  it('marks a non-finalized year with a provisional indicator in the header and a footnote', () => {
    const wrapper = mount(TradeTable, { props: { title: 'Imports', table: FIXTURE_IMPORTS_TABLE } })
    const headers = wrapper.findAll('thead th')
    // 2025 is the one year not in years_finalized in the fixture.
    const year2025Header = headers.find((h) => h.text().startsWith('2025'))
    expect(year2025Header?.text()).toContain('*')
    const finalizedHeader = headers.find((h) => h.text().startsWith('2021'))
    expect(finalizedHeader?.text()).not.toContain('*')
    expect(wrapper.text()).toContain('Provisional')
    expect(wrapper.text()).toContain('2025')
  })

  it('shows the excluded-partner-codes transparency footnote only when there are any', () => {
    const withExclusions = mount(TradeTable, {
      props: { title: 'Imports', table: FIXTURE_IMPORTS_TABLE },
    })
    expect(withExclusions.text()).toContain('W00')
    expect(withExclusions.text()).toContain('S19')

    const withoutExclusions = mount(TradeTable, {
      props: { title: 'Imports', table: { ...FIXTURE_IMPORTS_TABLE, excluded_partner_codes: [] } },
    })
    expect(withoutExclusions.text()).not.toContain('excluded')
  })

  it('shows the table unit', () => {
    const wrapper = mount(TradeTable, { props: { title: 'Imports', table: FIXTURE_IMPORTS_TABLE } })
    expect(wrapper.text()).toContain('USD')
  })

  it('renders an explicit empty-data message instead of a blank table when there are zero rows', () => {
    const wrapper = mount(TradeTable, {
      props: { title: 'Exports', table: FIXTURE_EMPTY_TRADE_TABLE },
    })
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.text().toLowerCase()).toContain('no exports data available')
  })

  it('renders a partner country name containing markup as inert escaped text, never executed HTML', () => {
    const hostile: TradeTableType = {
      ...FIXTURE_IMPORTS_TABLE,
      rows: [
        {
          partner_country: '<img src=x onerror=alert(1)>',
          partner_code: '999',
          values_by_year: { '2021': 1 },
          cumulative_5yr: 1,
          rank: 1,
        },
      ],
    }
    const wrapper = mount(TradeTable, { props: { title: 'Imports', table: hostile } })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
  })
})
