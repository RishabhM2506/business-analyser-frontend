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

// The real backend wraps *every* POST /threads/{id}/messages response body —
// success or error alike — in the same {type: 'final', data: ...} envelope
// (docs/PLAN.md §3.3, Phase 4 finding ARCH-01/B1's concrete fix). Before this
// fix, this fixture was a bare, un-enveloped ErrorResponse — a shape the real
// backend never actually sends for this endpoint, which is exactly the class
// of drift ARCH-01 flags ("nothing ever tested it against the real backend
// contract"). Wrapping it here means this e2e spec would fail to catch a
// real BUDGET_EXCEEDED response the same way api.ts's own unwrapping logic
// now handles it, instead of silently passing against a shape that only
// superficially resembles the real one.
const E2E_BUDGET_EXCEEDED_ERROR_RESPONSE: ErrorResponse = {
  error_code: 'BUDGET_EXCEEDED',
  message: 'This service has reached its usage limit for now. Please try again later.',
  // Real backend value, confirmed against app/nodes/describe_item.py and
  // app/nodes/summarize.py (Phase 4 finding M19/Frontend-QA#7) — BUDGET_EXCEEDED
  // is retryable:true on the wire, even though a retry against the shared
  // per-day ceiling frequently can't succeed until the next UTC day.
  retryable: true,
  trace_id: 'e2e-trace-budget',
}

// Deliberately not typed `ResponseEnvelope`: that type's 'final' variant is
// `data: TradeAnalysisResponse` (the shape `useStreamingResponse.ts`'s
// success path expects — the real backend always sends an error via a
// non-2xx status, which `services/api.ts`'s interceptor intercepts and
// converts to a rejected ApiError before this shape would ever reach that
// code, per app/main.py's `_ERROR_STATUS_CODES`). This fixture instead
// stands in for the raw, unshaped wire body Playwright's route mock hands
// back — exactly what a real `{status: 429, body: ...}` response looks like
// before any TypeScript type applies to it.
export const E2E_BUDGET_EXCEEDED_ENVELOPE: { type: 'final'; data: ErrorResponse } = {
  type: 'final',
  data: E2E_BUDGET_EXCEEDED_ERROR_RESPONSE,
}
