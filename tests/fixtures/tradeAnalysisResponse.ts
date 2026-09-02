import type { CountryRow, TradeAnalysisResponse, TradeBalance, TradeTable } from '@/types/generated'

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
      coefficient_of_variation: 0.03,
      is_high_volatility: false,
      cagr: -0.0025,
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
      // CAGR uses the real endpoints (2021 -> 2025), skipping the null year.
      coefficient_of_variation: 0.025,
      is_high_volatility: false,
      cagr: 0.00415,
    }),
  ],
  // 2026-09-02, Step 3 hardening (Concern 1: "preserve the denominator") —
  // every real partner ranked below the top 2 shown above, summed.
  rest_of_world: makeRow({
    partner_country: 'All Other Countries',
    partner_code: '_REST_OF_WORLD_',
    rank: 3,
    values_by_year: {
      '2021': 150_000,
      '2022': 160_000,
      '2023': 170_000,
      '2024': 155_000,
      '2025': 165_000,
    },
    cumulative_5yr: 800_000,
    coefficient_of_variation: 0.05,
    is_high_volatility: false,
    cagr: 0.024,
  }),
  // Comtrade's own reported World total — 2023 is a deliberate mismatch
  // (700,000 reported vs. 650,000 computed from the shown rows) so the
  // reconciliation-mismatch footnote has something real to render against.
  world_total_comtrade: {
    '2021': 950_000,
    '2022': 990_000,
    '2023': 700_000,
    '2024': 955_000,
    '2025': 965_000,
  },
  world_total_reconciles: {
    '2021': true,
    '2022': true,
    '2023': false,
    '2024': true,
    '2025': true,
  },
  // Representative fixture value — not literally derived from a per-country
  // breakdown of the rest_of_world bucket above (this fixture doesn't model
  // one), unlike the real backend's `_compute_hhi` (app/nodes/aggregate.py).
  hhi: 0.34,
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
      coefficient_of_variation: 0.1,
      is_high_volatility: false,
      cagr: 0.067,
    }),
  ],
  // A single dominant partner and no truncated tail — no rest_of_world row,
  // and the world total exactly matches China's own reported figures.
  world_total_comtrade: {
    '2021': 200_000,
    '2022': 210_000,
    '2023': 225_000,
    '2024': 240_000,
    '2025': 260_000,
  },
  world_total_reconciles: {
    '2021': true,
    '2022': true,
    '2023': true,
    '2024': true,
    '2025': true,
  },
  hhi: 1.0, // one real partner = full concentration
}

// Exports-minus-imports using each table's own world_total_comtrade above
// (200_000 - 950_000 = -750_000 for 2021, and so on) — India is a net
// importer of this product throughout the window shown.
export const FIXTURE_TRADE_BALANCE: TradeBalance = {
  by_year: {
    '2021': -750_000,
    '2022': -780_000,
    '2023': -475_000,
    '2024': -715_000,
    '2025': -705_000,
  },
  cumulative: -3_425_000,
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
  trade_balance: FIXTURE_TRADE_BALANCE,
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

// 2026-08-20 roadmap decision (live user-reported finding): a year whose
// Comtrade fetch itself failed after every retry attempt — distinct from
// both a provisional year and a genuine no-data year (see
// FIXTURE_IMPORTS_TABLE_WITH_NO_DATA_YEAR above for that pair). 2023 here
// is the fetch-failed year; 2021 is fully finalized; 2025 is genuinely
// provisional — three different years, three different footnotes.
export const FIXTURE_IMPORTS_TABLE_WITH_FETCH_ISSUE: TradeTable = {
  unit: 'USD',
  years: [2021, 2022, 2023, 2024, 2025],
  years_finalized: [2021, 2022, 2024],
  fetch_issues: ['2023: UN Comtrade returned retryable status 429'],
  fetch_issue_years: [2023],
  excluded_partner_codes: [],
  rows: [
    makeRow({
      partner_country: 'United States',
      partner_code: '842',
      rank: 1,
      values_by_year: {
        '2021': 500_000,
        '2022': 520_000,
        '2023': null,
        '2024': 510_000,
        '2025': 495_000,
      },
      cumulative_5yr: 2_025_000,
    }),
  ],
}

export const FIXTURE_EMPTY_TRADE_BALANCE: TradeBalance = {
  by_year: { '2021': null, '2022': null, '2023': null, '2024': null, '2025': null },
  cumulative: null,
}

export const FIXTURE_EMPTY_TRADE_ANALYSIS_RESPONSE: TradeAnalysisResponse = {
  ...FIXTURE_TRADE_ANALYSIS_RESPONSE,
  hs_code: '999999',
  imports: FIXTURE_EMPTY_TRADE_TABLE,
  exports: FIXTURE_EMPTY_TRADE_TABLE,
  trade_balance: FIXTURE_EMPTY_TRADE_BALANCE,
  analytical_summary: 'No trade data was available for this item in the selected period.',
}

// A partner that traded a large amount once and then nothing — high CoV,
// contrasted with a stable partner at a similar cumulative value, so the
// "Volatility" column's badge has a real true/false case to render against
// (2026-09-02, Step 3 hardening, Concern 1).
export const FIXTURE_IMPORTS_TABLE_WITH_HIGH_VOLATILITY_PARTNER: TradeTable = {
  unit: 'USD',
  years: [2021, 2022, 2023, 2024, 2025],
  years_finalized: [2021, 2022, 2023, 2024, 2025],
  excluded_partner_codes: [],
  rows: [
    makeRow({
      partner_country: 'Spiky Exports Ltd Origin',
      partner_code: '999',
      rank: 1,
      values_by_year: { '2021': 30_000_000, '2022': 0, '2023': 0, '2024': 0, '2025': 0 },
      cumulative_5yr: 30_000_000,
      coefficient_of_variation: 2.0,
      is_high_volatility: true,
      cagr: null, // start value is a real number but end value is 0 — undefined growth rate
    }),
    makeRow({
      partner_country: 'Steady Partner',
      partner_code: '826',
      rank: 2,
      values_by_year: {
        '2021': 9_000_000,
        '2022': 9_000_000,
        '2023': 9_000_000,
        '2024': 9_000_000,
        '2025': 9_000_000,
      },
      cumulative_5yr: 45_000_000,
      coefficient_of_variation: 0.0,
      is_high_volatility: false,
      cagr: 0.0,
    }),
  ],
}
