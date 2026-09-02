import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TradeTable from '@/components/analysis/TradeTable.vue'
import type { TradeTable as TradeTableType } from '@/types/generated'

import {
  FIXTURE_EMPTY_TRADE_TABLE,
  FIXTURE_EXPORTS_TABLE,
  FIXTURE_IMPORTS_TABLE,
  FIXTURE_IMPORTS_TABLE_WITH_FETCH_ISSUE,
  FIXTURE_IMPORTS_TABLE_WITH_HIGH_VOLATILITY_PARTNER,
  FIXTURE_IMPORTS_TABLE_WITH_NO_DATA_YEAR,
} from '../fixtures/tradeAnalysisResponse'

describe('TradeTable', () => {
  it('renders one row per country, plus a trailing rest-of-world row, and the title as a heading', () => {
    const wrapper = mount(TradeTable, { props: { title: 'Imports', table: FIXTURE_IMPORTS_TABLE } })
    expect(wrapper.find('h3').text()).toBe('Imports')
    expect(wrapper.findAll('tbody tr')).toHaveLength(3) // 2 real countries + rest_of_world
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

  it('marks a no-data year distinctly from a provisional year, with its own footnote (M21/PBO-03)', () => {
    const wrapper = mount(TradeTable, {
      props: { title: 'Imports', table: FIXTURE_IMPORTS_TABLE_WITH_NO_DATA_YEAR },
    })
    const headers = wrapper.findAll('thead th')

    // 2021 has zero records - "no data", not "provisional".
    const year2021Header = headers.find((h) => h.text().startsWith('2021'))
    expect(year2021Header?.text()).toContain('†')
    expect(year2021Header?.text()).not.toContain('*')

    // 2025 has records but isn't finalized - still genuinely "provisional".
    const year2025Header = headers.find((h) => h.text().startsWith('2025'))
    expect(year2025Header?.text()).toContain('*')
    expect(year2025Header?.text()).not.toContain('†')

    // A fully finalized year gets neither marker.
    const year2022Header = headers.find((h) => h.text().startsWith('2022'))
    expect(year2022Header?.text()).not.toContain('*')
    expect(year2022Header?.text()).not.toContain('†')

    // The provisional footnote must not list the no-data year, and vice versa.
    const text = wrapper.text()
    expect(text).toContain('No data recorded for this year')
    expect(text).toContain('not expected to be added later')
    const provisionalFootnote = wrapper
      .findAll('.trade-table__footnote')
      .find((p) => p.text().startsWith('* Provisional'))
    expect(provisionalFootnote?.text()).toContain('2025')
    expect(provisionalFootnote?.text()).not.toContain('2021')
  })

  it('marks a fetch-failed year distinctly from provisional/no-data years, with its own footnote listing the real reason (2026-08-20)', () => {
    const wrapper = mount(TradeTable, {
      props: { title: 'Imports', table: FIXTURE_IMPORTS_TABLE_WITH_FETCH_ISSUE },
    })
    const headers = wrapper.findAll('thead th')

    // 2023 could not be fetched - its own marker, not "*" or "†".
    const year2023Header = headers.find((h) => h.text().startsWith('2023'))
    expect(year2023Header?.text()).toContain('‡')
    expect(year2023Header?.text()).not.toContain('*')

    // 2025 is genuinely provisional and must still show "*", unaffected by
    // the unrelated fetch failure on a different year.
    const year2025Header = headers.find((h) => h.text().startsWith('2025'))
    expect(year2025Header?.text()).toContain('*')
    expect(year2025Header?.text()).not.toContain('‡')

    // A fully finalized year gets no marker at all.
    const year2021Header = headers.find((h) => h.text().startsWith('2021'))
    expect(year2021Header?.text()).not.toContain('*')
    expect(year2021Header?.text()).not.toContain('‡')

    // The footnote lists the real, backend-composed reason verbatim, and
    // the "*" provisional footnote must not also claim the fetch-failed year.
    const text = wrapper.text()
    expect(text).toContain('UN Comtrade returned retryable status 429')
    expect(text).toContain("doesn't mean the data doesn't exist")
    const provisionalFootnote = wrapper
      .findAll('.trade-table__footnote')
      .find((p) => p.text().startsWith('* Provisional'))
    expect(provisionalFootnote?.text()).toContain('2025')
    expect(provisionalFootnote?.text()).not.toContain('2023')
  })

  it('does not show the fetch-issue footnote when fetch_issues is absent or empty', () => {
    const wrapper = mount(TradeTable, { props: { title: 'Imports', table: FIXTURE_IMPORTS_TABLE } })
    expect(wrapper.text()).not.toContain("doesn't mean the data doesn't exist")
    expect(wrapper.findAll('thead th').some((h) => h.text().includes('‡'))).toBe(false)
  })

  it('does not show the no-data footnote when years_no_data is absent (older/stale fixture shape)', () => {
    // FIXTURE_IMPORTS_TABLE predates this field entirely - the component
    // must not crash or misbehave on a table shaped without it.
    const wrapper = mount(TradeTable, { props: { title: 'Imports', table: FIXTURE_IMPORTS_TABLE } })
    expect(wrapper.text()).not.toContain('No data recorded for this year')
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

  it('explains what "—" means whenever any cell is actually missing data (M23/PBO-05)', () => {
    // FIXTURE_IMPORTS_TABLE has a real null cell (Germany, 2023).
    const wrapper = mount(TradeTable, { props: { title: 'Imports', table: FIXTURE_IMPORTS_TABLE } })
    expect(wrapper.text()).toContain('does not mean zero trade occurred')
  })

  it('does not show the missing-data footnote when every cell has a real reported value', () => {
    // FIXTURE_EXPORTS_TABLE has no null cells.
    const wrapper = mount(TradeTable, { props: { title: 'Exports', table: FIXTURE_EXPORTS_TABLE } })
    expect(wrapper.text()).not.toContain('does not mean zero trade occurred')
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

  // --- rest_of_world / world_total / hhi (2026-09-02, Step 3 hardening) ---

  it('renders the rest_of_world row distinctly, after the ranked countries, with its own values', () => {
    const wrapper = mount(TradeTable, { props: { title: 'Imports', table: FIXTURE_IMPORTS_TABLE } })
    const rows = wrapper.findAll('tbody tr')
    const lastRow = rows[rows.length - 1]
    expect(lastRow?.text()).toContain('All Other Countries')
    expect(lastRow?.classes()).toContain('trade-table__row--rest-of-world')
    const cells = lastRow?.findAll('td') ?? []
    expect(cells[2]?.text()).toBe('$150,000.00') // 2021
    expect(cells[7]?.text()).toBe('$800,000.00') // 5-yr total
  })

  it('does not render a rest_of_world row when the table has none', () => {
    const wrapper = mount(TradeTable, { props: { title: 'Exports', table: FIXTURE_EXPORTS_TABLE } })
    expect(wrapper.text()).not.toContain('All Other Countries')
    expect(wrapper.find('.trade-table__row--rest-of-world').exists()).toBe(false)
  })

  it('shows the HHI concentration footnote when present', () => {
    const wrapper = mount(TradeTable, { props: { title: 'Imports', table: FIXTURE_IMPORTS_TABLE } })
    expect(wrapper.text()).toContain('Market concentration (HHI): 0.34')
  })

  it('does not show the HHI footnote when absent (older/stale fixture shape)', () => {
    const wrapper = mount(TradeTable, {
      props: { title: 'Imports', table: FIXTURE_IMPORTS_TABLE_WITH_NO_DATA_YEAR },
    })
    expect(wrapper.text()).not.toContain('Market concentration')
  })

  it('flags a real world-total reconciliation mismatch, naming the affected year', () => {
    const wrapper = mount(TradeTable, { props: { title: 'Imports', table: FIXTURE_IMPORTS_TABLE } })
    expect(wrapper.text()).toContain('do not reconcile')
    expect(wrapper.text()).toContain('2023')
  })

  it('does not show the reconciliation-mismatch footnote when everything reconciles', () => {
    const wrapper = mount(TradeTable, { props: { title: 'Exports', table: FIXTURE_EXPORTS_TABLE } })
    expect(wrapper.text()).not.toContain('do not reconcile')
  })

  // --- CAGR / volatility columns (2026-09-02, Step 3 hardening) -----------

  it('renders each row’s CAGR as a signed percentage', () => {
    const wrapper = mount(TradeTable, { props: { title: 'Imports', table: FIXTURE_IMPORTS_TABLE } })
    const rows = wrapper.findAll('tbody tr')
    const usRow = rows.find((row) => row.text().includes('United States'))
    const germanyRow = rows.find((row) => row.text().includes('Germany'))
    const usCells = usRow?.findAll('td') ?? []
    const germanyCells = germanyRow?.findAll('td') ?? []
    expect(usCells[8]?.text()).toBe('-0.3%') // negative CAGR
    expect(germanyCells[8]?.text()).toBe('+0.4%') // positive CAGR
  })

  it('renders a "—" for a null CAGR, not a fabricated figure', () => {
    const wrapper = mount(TradeTable, {
      props: { title: 'Imports', table: FIXTURE_IMPORTS_TABLE_WITH_HIGH_VOLATILITY_PARTNER },
    })
    const rows = wrapper.findAll('tbody tr')
    const spikyRow = rows.find((row) => row.text().includes('Spiky'))
    const cells = spikyRow?.findAll('td') ?? []
    expect(cells[8]?.text()).toBe('—')
  })

  it('shows a "High" volatility badge only for a partner flagged is_high_volatility', () => {
    const wrapper = mount(TradeTable, {
      props: { title: 'Imports', table: FIXTURE_IMPORTS_TABLE_WITH_HIGH_VOLATILITY_PARTNER },
    })
    const rows = wrapper.findAll('tbody tr')
    const spikyRow = rows.find((row) => row.text().includes('Spiky'))
    const steadyRow = rows.find((row) => row.text().includes('Steady'))
    expect(spikyRow?.find('.trade-table__volatility-badge').exists()).toBe(true)
    expect(spikyRow?.find('.trade-table__volatility-badge').text()).toBe('High')
    expect(steadyRow?.find('.trade-table__volatility-badge').exists()).toBe(false)
  })
})
