// Hand-ported from the backend's Pydantic contracts (docs/PLAN.md §3.1–§3.2 in the
// sibling BusinessAnalysingAgent repo). TODO: replace with generated types (e.g.
// `openapi-typescript` against the backend's OpenAPI schema) once that schema is
// stable — hand-maintaining this file is a deliberate, temporary Phase 2 choice,
// not the long-term plan. If you touch a backend schema, update this file in the
// same change.

/**
 * The only way any node/endpoint receives filter parameters — never positional
 * args (master brief §3). Mirrors `TradeQuery` (Pydantic). Fields with a
 * server-side default are optional here: the frontend may omit them and let the
 * backend apply the default.
 */
export interface TradeQuery {
  /** HS6 sub-heading. Backend-validated: pattern `^\d{6}$`, then checked against the taxonomy allowlist. */
  hs_code: string
  flow?: TradeFlow
  /** `null`/omitted = latest available year - 4. */
  year_start?: number | null
  /** `null`/omitted = latest available year. */
  year_end?: number | null
  /** Unused in v1 — reserved for a future roadmap filter (docs/PLAN.md §3.1). */
  partner_region?: string | null
  /** v1 supports `"value"` only; `"volume"` is reserved. */
  value_or_volume?: ValueOrVolume
  tenant_id?: string
  user_id?: string
}

export type TradeFlow = 'import' | 'export' | 'both'
export type ValueOrVolume = 'value' | 'volume'

/** Mirrors `Provenance` (Pydantic). */
export interface Provenance {
  source: 'UN Comtrade (comtradeapi.un.org)'
  /** ISO 8601 timestamp string — Pydantic `datetime` serializes to a string over JSON. */
  retrieved_at: string
  /** Explicit: calendar year, NOT Indian fiscal year (Gate 0 finding, docs/PLAN.md §3.2). */
  period_type: 'calendar_year'
  currency: 'USD'
  prompt_version: string
  /**
   * Phase 4 finding M22/PBO-04: the product never stated anywhere that this
   * is India's trade data. Backend fix (parallel PR, not yet merged as of
   * this change — confirmed against business-analyser-agentic-workflow's
   * `app/schemas/response.py`) adds this field to `Provenance`. Optional
   * here specifically so this frontend keeps working (rendering gracefully
   * degrades, not crashes) against the real backend for however long the
   * two PRs are merged out of sync — see ProvenanceFootnote.vue's `v-if`.
   */
  reporter_country?: 'India'
}

/** Mirrors `CountryRow` (Pydantic). */
export interface CountryRow {
  partner_country: string
  partner_code: string
  /**
   * Keyed by year. Pydantic types this `dict[int, float | None]`, but JSON
   * object keys are always strings on the wire — parse with `Number(key)`
   * before use. `null` means no data for that year: render "—", never
   * interpolate (master brief §2.2).
   */
  values_by_year: Record<string, number | null>
  cumulative_5yr: number
  /** Rank by `cumulative_5yr`, per Gate 0 answer. */
  rank: number
}

/** Mirrors `TradeTable` (Pydantic). */
export interface TradeTable {
  unit: 'USD'
  years: number[]
  /** Subset of `years` NOT flagged provisional by Comtrade. */
  years_finalized: number[]
  /**
   * Subset of `years` with ZERO retained records at all (finding
   * M21/PBO-03) — disjoint from `years_finalized`'s complement. A year here
   * commonly means this HS6 code didn't exist in that year's HS
   * nomenclature edition, not that data is still settling; render with
   * different, non-promissory copy than a genuinely provisional year.
   * Optional for backward compatibility with any stale fixture/mock data
   * that predates this field — treat a missing value as `[]`.
   */
  years_no_data?: number[]
  /** Transparency: aggregate/"nes" partner codes stripped before ranking. */
  excluded_partner_codes: string[]
  /** Top 10, ranked. */
  rows: CountryRow[]
}

/** Mirrors `TradeAnalysisResponse` (Pydantic) — the success shape of `POST /threads/{id}/messages`. */
export interface TradeAnalysisResponse {
  thread_id: string
  message_id: string
  hs_code: string
  item_description: string
  imports: TradeTable
  exports: TradeTable
  analytical_summary: string
  provenance: Provenance
}

/**
 * Mirrors `ErrorResponse` (Pydantic). Every response — success or error — is
 * schema-validated on the way out; a validation failure comes back as this
 * shape with `error_code: "SCHEMA_VALIDATION_FAILED"`, never a partial/silent
 * render (docs/PLAN.md §3.2).
 */
export interface ErrorResponse {
  /** e.g. "UPSTREAM_TIMEOUT", "BUDGET_EXCEEDED", "INVALID_HS_CODE". */
  error_code: string
  /** User-safe. Never a raw stack trace (master brief §9). */
  message: string
  retryable: boolean
  trace_id: string
}

/**
 * The `POST /threads/{id}/messages` wire format is an envelope with a `type`
 * discriminator (docs/PLAN.md §3.3): v1 sends the full response as a single
 * `"final"` chunk, so a future `"delta"` streaming chunk is additive, not
 * breaking. The `"delta"` shape isn't specified yet — deliberately not
 * fabricated here.
 */
export type ResponseEnvelope =
  | { type: 'final'; data: TradeAnalysisResponse }
  // TODO(Phase 3+): shape not yet defined in docs/PLAN.md — reserved for incremental streaming chunks.
  | { type: 'delta'; data: unknown }

/** `POST /threads` response shape (docs/PLAN.md §3.3: "Returns `{thread_id}`"). */
export interface CreateThreadResponse {
  thread_id: string
}

/**
 * `GET /threads/{id}` response shape. docs/PLAN.md §3.3 only specifies "thread
 * state/history — for resume-after-refresh," not an exact schema — left
 * intentionally loose rather than fabricated. Refine once the endpoint exists.
 */
export interface ThreadState {
  thread_id: string
  // TODO(Phase 3): replace with the real per-message shape once GET /threads/{id} is implemented.
  messages: unknown[]
}
