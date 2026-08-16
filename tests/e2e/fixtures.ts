import type { ErrorResponse, ResponseEnvelope } from '../../src/types/generated'

// Hand-written fixtures for mocking the backend in Playwright e2e tests (the
// backend isn't reachable while building this slice — see the frontend
// repo's task brief). Kept e2e-local rather than importing tests/fixtures/*
// to avoid depending on the `@/*` path alias resolving inside Playwright's
// own (separate from Vitest's) module runner. Deliberately picks a category
// (chapter 01, "Animals; live") and item (010121) that are real rows in the
// checked-in public/hs-taxonomy.json, since e2e exercises that file for
// real — only the backend calls are mocked.

export const E2E_CATEGORY_CODE = '01'
export const E2E_CATEGORY_QUERY = 'Animals'
export const E2E_ITEM_HS_CODE = '010121'
export const E2E_ITEM_DESCRIPTION = 'Horses; live, pure-bred breeding animals'

export const E2E_THREAD_ID = 'e2e-thread-1'

export const E2E_ANALYSIS_ENVELOPE: ResponseEnvelope = {
  type: 'final',
  data: {
    thread_id: E2E_THREAD_ID,
    message_id: 'e2e-message-1',
    hs_code: E2E_ITEM_HS_CODE,
    item_description: 'Live, pure-bred breeding horses used for equestrian and breeding purposes.',
    imports: {
      unit: 'USD',
      years: [2021, 2022, 2023, 2024, 2025],
      years_finalized: [2021, 2022, 2023, 2024],
      excluded_partner_codes: ['W00'],
      rows: [
        {
          partner_country: 'United States',
          partner_code: '842',
          values_by_year: {
            '2021': 500_000,
            '2022': 520_000,
            '2023': null,
            '2024': 510_000,
            '2025': 495_000,
          },
          cumulative_5yr: 2_025_000,
          rank: 1,
        },
        {
          partner_country: 'Germany',
          partner_code: '276',
          values_by_year: {
            '2021': 300_000,
            '2022': 310_000,
            '2023': 295_000,
            '2024': 290_000,
            '2025': 305_000,
          },
          cumulative_5yr: 1_500_000,
          rank: 2,
        },
      ],
    },
    exports: {
      unit: 'USD',
      years: [2021, 2022, 2023, 2024, 2025],
      years_finalized: [2021, 2022, 2023, 2024, 2025],
      excluded_partner_codes: [],
      rows: [
        {
          partner_country: 'Canada',
          partner_code: '124',
          values_by_year: {
            '2021': 100_000,
            '2022': 110_000,
            '2023': 120_000,
            '2024': 130_000,
            '2025': 140_000,
          },
          cumulative_5yr: 600_000,
          rank: 1,
        },
      ],
    },
    analytical_summary:
      'Imports were led by the United States, though 2023 data was not reported.\n\nExports were concentrated in Canada, growing steadily over the period.',
    provenance: {
      source: 'UN Comtrade (comtradeapi.un.org)',
      retrieved_at: '2026-08-10T12:00:00Z',
      period_type: 'calendar_year',
      currency: 'USD',
      prompt_version: 'e2e-v1',
    },
  },
}

export const E2E_BUDGET_EXCEEDED_ERROR: ErrorResponse = {
  error_code: 'BUDGET_EXCEEDED',
  message: 'This service has reached its usage limit for now. Please try again later.',
  retryable: false,
  trace_id: 'e2e-trace-budget',
}
