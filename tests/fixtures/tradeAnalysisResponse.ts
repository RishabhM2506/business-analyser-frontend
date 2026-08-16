import type { CountryRow, TradeAnalysisResponse, TradeTable } from '@/types/generated'

// Hand-written fixtures shaped exactly like the backend's Pydantic contracts
// (docs/PLAN.md §3.2), matching src/types/generated.ts field-for-field — the
// backend isn't reachable while building this slice, so these stand in for a
// live response in both component and store tests. Deliberately includes a
// `null` cell (missing-data rendering is the one hard correctness rule,
// master brief §2.2), a provisional (non-finalized) year, and a non-empty
// `excluded_partner_codes` so every footnote path has something real to
// render against.

function makeRow(
  overrides: Partial<CountryRow> & Pick<CountryRow, 'partner_country' | 'partner_code' | 'rank'>,
): CountryRow {
  return {
    values_by_year: { '2021': 100, '2022': 110, '2023': 120, '2024': 130, '2025': 140 },
    cumulative_5yr: 600,
    ...overrides,
  }
}

export const FIXTURE_IMPORTS_TABLE: TradeTable = {
  unit: 'USD',
  years: [2021, 2022, 2023, 2024, 2025],
  years_finalized: [2021, 2022, 2023, 2024], // 2025 is provisional
  excluded_partner_codes: ['W00', 'S19'],
  rows: [
    makeRow({
      partner_country: 'United States',
      partner_code: '842',
      rank: 1,
      values_by_year: {
        '2021': 500_000,
        '2022': 520_000,
        '2023': 480_000,
        '2024': 510_000,
        '2025': 495_000,
      },
      cumulative_5yr: 2_505_000,
    }),
    makeRow({
      partner_country: 'Germany',
      partner_code: '276',
      rank: 2,
      // A gap: no data reported for 2023 — this is the case that must render "—".
      values_by_year: {
        '2021': 300_000,
        '2022': 310_000,
        '2023': null,
        '2024': 290_000,
        '2025': 305_000,
      },
      cumulative_5yr: 1_205_000,
    }),
  ],
}

export const FIXTURE_EXPORTS_TABLE: TradeTable = {
  unit: 'USD',
  years: [2021, 2022, 2023, 2024, 2025],
  years_finalized: [2021, 2022, 2023, 2024, 2025],
  excluded_partner_codes: [],
  rows: [
    makeRow({
      partner_country: 'China',
      partner_code: '156',
      rank: 1,
      values_by_year: {
        '2021': 200_000,
        '2022': 210_000,
        '2023': 225_000,
        '2024': 240_000,
        '2025': 260_000,
      },
      cumulative_5yr: 1_135_000,
    }),
  ],
}

export const FIXTURE_PROVENANCE = {
  source: 'UN Comtrade (comtradeapi.un.org)' as const,
  retrieved_at: '2026-08-10T12:00:00Z',
  period_type: 'calendar_year' as const,
  currency: 'USD' as const,
  prompt_version: 'v1.0.0',
}

export const FIXTURE_TRADE_ANALYSIS_RESPONSE: TradeAnalysisResponse = {
  thread_id: 'thread-fixture-1',
  message_id: 'message-fixture-1',
  hs_code: '010121',
  item_description:
    'Live, pure-bred breeding horses.\n\nCommonly traded for equestrian and breeding purposes.',
  imports: FIXTURE_IMPORTS_TABLE,
  exports: FIXTURE_EXPORTS_TABLE,
  analytical_summary:
    'Imports were led by the United States at $2,505,000 cumulative over five years.\n\nGermany followed with $1,205,000, though 2023 data was not reported.',
  provenance: FIXTURE_PROVENANCE,
}

export const FIXTURE_EMPTY_TRADE_TABLE: TradeTable = {
  unit: 'USD',
  years: [2021, 2022, 2023, 2024, 2025],
  years_finalized: [2021, 2022, 2023, 2024, 2025],
  excluded_partner_codes: [],
  rows: [],
}

// Finding M21/PBO-03: a real live shape (HS 851713, "smartphones" — a code
// created only in the HS 2022 nomenclature revision) — 2021 has zero
// records for every partner, distinct from 2025 which has records but
// isn't finalized yet. Kept as its own fixture rather than mutating
// FIXTURE_IMPORTS_TABLE above, since several existing tests assert that
// fixture's exact shape.
export const FIXTURE_IMPORTS_TABLE_WITH_NO_DATA_YEAR: TradeTable = {
  unit: 'USD',
  years: [2021, 2022, 2023, 2024, 2025],
  years_finalized: [2022, 2023, 2024],
  years_no_data: [2021], // this HS6 code didn't exist in the 2021 nomenclature
  excluded_partner_codes: [],
  rows: [
    makeRow({
      partner_country: 'United States',
      partner_code: '842',
      rank: 1,
      values_by_year: {
        '2021': null,
        '2022': 520_000,
        '2023': 480_000,
        '2024': 510_000,
        '2025': 495_000,
      },
      cumulative_5yr: 2_005_000,
    }),
  ],
}

export const FIXTURE_EMPTY_TRADE_ANALYSIS_RESPONSE: TradeAnalysisResponse = {
  ...FIXTURE_TRADE_ANALYSIS_RESPONSE,
  hs_code: '999999',
  imports: FIXTURE_EMPTY_TRADE_TABLE,
  exports: FIXTURE_EMPTY_TRADE_TABLE,
  analytical_summary: 'No trade data was available for this item in the selected period.',
}
