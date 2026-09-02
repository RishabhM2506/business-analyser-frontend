import type {
  ErrorResponse,
  ProductSearchResponse,
  ResponseEnvelope,
  TradeAnalysisResponse,
  TradeReportResponse,
} from '../../src/types/generated'

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

/**
 * Phase 4 finding M18/Frontend-QA#6: `router/index.ts`'s navigation lockout
 * blocks a second mouse-driven selection landing within ~40px of a previous
 * one for `NAVIGATION_LOCKOUT_MS` (400ms) — this is what stops the reported
 * fast-double-click bug (see that file's doc comment for the full
 * rationale, including why position alone isn't enough: the category and
 * item rows can land only a few px apart in this app's real layout). A
 * scripted `.click()` immediately followed by another `.click()` with zero
 * delay is not a realistic stand-in for a human's two *separate, deliberate*
 * selections (choosing a category, then choosing an item on the next
 * screen) — real specs exercising that normal sequential flow should wait
 * at least this long between the two clicks so they aren't misread as the
 * same double-click echo the lockout exists to catch.
 */
export const NAVIGATION_LOCKOUT_CLEAR_MS = 450

const E2E_ANALYSIS_DATA: TradeAnalysisResponse = {
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
  trade_balance: {
    by_year: {
      '2021': -400_000,
      '2022': -410_000,
      '2023': null, // imports' own world total is unknown for 2023 in this fixture
      '2024': -380_000,
      '2025': -355_000,
    },
    cumulative: -1_545_000,
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
}

export const E2E_ANALYSIS_ENVELOPE: ResponseEnvelope = {
  type: 'final',
  data: E2E_ANALYSIS_DATA,
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

// POST /threads/{id}/search fixtures (2026-08-20 roadmap decision). Bare
// bodies, not {type, data}-enveloped — see types/generated.ts's
// ProductSearchResponse doc comment; unlike the /messages fixtures above,
// these are handed to route.fulfill()'s `json` directly.

export const E2E_SEARCH_DISAMBIGUATE_RESPONSE: ProductSearchResponse = {
  thread_id: E2E_THREAD_ID,
  query_text: 'coffee',
  outcome: 'disambiguate',
  candidates: [
    {
      hs_code: '090111',
      description: 'Coffee; not roasted, not decaffeinated',
      relevance_score: 0.62,
    },
    { hs_code: '090121', description: 'Coffee; roasted, not decaffeinated', relevance_score: 0.55 },
    { hs_code: '090190', description: 'Coffee; husks and skins', relevance_score: 0.3 },
  ],
}

// A high-confidence match (2026-09-02 product decision: even this still
// goes through the disambiguation picker — auto-selecting on the user's
// behalf was removed entirely, see ProductSearchResults.vue's own doc
// comment). Only one real candidate, so the picker shows it plus the
// always-present "Something else" option.
export const E2E_SEARCH_HIGH_CONFIDENCE_RESPONSE: ProductSearchResponse = {
  thread_id: E2E_THREAD_ID,
  query_text: 'green coffee beans',
  outcome: 'disambiguate',
  candidates: [
    {
      hs_code: '090111',
      description: 'Coffee; not roasted, not decaffeinated',
      relevance_score: 0.93,
    },
  ],
}

export const E2E_SEARCH_NO_CANDIDATES_RESPONSE: ProductSearchResponse = {
  thread_id: E2E_THREAD_ID,
  query_text: 'zzzqqqxxx nonsense gibberish',
  outcome: 'no_candidates_found',
  candidates: [],
}

/**
 * A `POST /threads/{id}/messages` envelope whose `hs_code` matches the
 * search fixtures above (`090111`, coffee) rather than the general-purpose
 * `E2E_ANALYSIS_ENVELOPE`'s `010121` (horses) — used only by
 * `product-search.spec.ts` so the rendered "HS ..." eyebrow above the
 * "Trade analysis" heading matches whatever the search flow actually
 * selected.
 */
export const E2E_COFFEE_ANALYSIS_ENVELOPE: ResponseEnvelope = {
  type: 'final',
  data: {
    ...E2E_ANALYSIS_DATA,
    hs_code: '090111',
    item_description: 'Coffee beans that have not been roasted or decaffeinated.',
  },
}

// POST /threads/{id}/trade-report fixture (2026-08-25 addition) — bare body,
// not {type, data}-enveloped, same reasoning as the /search fixtures above.
// Reuses E2E_ITEM_HS_CODE (010121, horses) so a spec can navigate there via
// "View duty verification..." from an already-mocked /messages response
// without needing a second, unrelated HS code.
export const E2E_TRADE_REPORT_RESPONSE: TradeReportResponse = {
  thread_id: E2E_THREAD_ID,
  facts: {
    hs6: E2E_ITEM_HS_CODE,
    product_label: E2E_ITEM_DESCRIPTION,
    flow: 'import',
    window: { years: 5, start_year: 2021, end_year: 2025 },
    top_n: 10,
    annual_series: [],
    month_wise_current_year: [],
    unit_value_trend: [],
    hhi_by_year: [],
    overall_cagr: null,
    overall_volatility: null,
    cagr_by_partner: {},
    volatility_by_partner: {},
    landed_cost: {
      is_complete: false,
      landed_cost_inr_paise_per_kg: null,
      partial_landed_cost_inr_paise_per_kg: 45000,
      excluded_components: ['AIDC', 'SWS', 'IGST'],
      components: {
        BCD: {
          component: 'BCD',
          verification_status: 'VERIFIED',
          value_pct: '30.000',
          source_authority: 'ICEGATE Trade Guide on Imports',
          source_reference: 'e2e fixture',
          source_url: 'https://www.icegate.gov.in/Webappl/Desc_details?cth=01012100',
          verified_date: '2026-08-24',
          notes: null,
          conflicting_candidates: null,
        },
        AIDC: {
          component: 'AIDC',
          verification_status: 'NOT_VERIFIED',
          value_pct: null,
          source_authority: null,
          source_reference: null,
          source_url: null,
          verified_date: null,
          notes: null,
          conflicting_candidates: null,
        },
        SWS: {
          component: 'SWS',
          verification_status: 'NOT_VERIFIED',
          value_pct: null,
          source_authority: null,
          source_reference: null,
          source_url: null,
          verified_date: null,
          notes: null,
          conflicting_candidates: null,
        },
        IGST: {
          component: 'IGST',
          verification_status: 'NOT_VERIFIED',
          value_pct: null,
          source_authority: null,
          source_reference: null,
          source_url: null,
          verified_date: null,
          notes: null,
          conflicting_candidates: null,
        },
      },
    },
    landed_cost_as_of_period: '2025',
    mismatch_checks: [],
    regulatory_note: null,
    regulatory_note_missing_warning: false,
    coverage: null,
    hs8_split_note: '',
    mandi_price: {
      status: 'NOT_APPLICABLE',
      matched_commodity: null,
      modal_price_inr_paise_per_qtl: null,
      price_date: null,
      market: null,
      state: null,
    },
    msp: {
      status: 'NOT_APPLICABLE',
      matched_commodity: null,
      year_label: null,
      msp_inr_paise_per_qtl: null,
      cost_inr_paise_per_qtl: null,
    },
    international_production: {
      status: 'NOT_APPLICABLE',
      matched_item: null,
      year: null,
      india_status: null,
      india_production_tonnes: null,
      world_production_tonnes: null,
    },
    llm_datapoints: [],
    mandi_price_llm_datapoints: [],
    msp_llm_datapoints: [],
    international_production_llm_datapoints: [],
  },
  narrative:
    'Landed cost as of 2025 is incomplete (unverified: AIDC, SWS, IGST). Only BCD (30%) is confirmed.',
  narrative_source: 'model',
}
