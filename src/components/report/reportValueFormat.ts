// Pure display formatting for the trade-report pipeline's own value shapes
// (INR paise integers, Decimal-as-JSON-string fields) — mirrors
// `analysis/tradeValueFormat.ts`'s "never blank, never interpolated" rule,
// applied to this page's own fields.

export const MISSING_VALUE_DISPLAY = '—'

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

/**
 * Formats an INR-paise integer field (e.g. `landed_cost_inr_paise_per_kg`,
 * `modal_price_inr_paise_per_qtl`) as rupees. `null` (this pipeline's
 * evidence-first "genuinely unknown," never a guessed value — D2) renders
 * as the missing-data marker, never ₹0.
 */
export function formatInrPaise(paise: number | null): string {
  if (paise === null) {
    return MISSING_VALUE_DISPLAY
  }
  return inrFormatter.format(paise / 100)
}

/**
 * Formats a `Decimal`-typed field the backend serializes as a JSON string
 * (e.g. `value_pct`, `world_production_tonnes`) as a percentage. `null`
 * renders as the missing-data marker, never 0% (the exact distinction
 * `app.pipeline.duty_source`'s own evidence model exists to enforce).
 */
export function formatPercent(value: string | null): string {
  if (value === null) {
    return MISSING_VALUE_DISPLAY
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return MISSING_VALUE_DISPLAY
  }
  // Rounded to 2dp (trailing zeros drop naturally on number->string) — the
  // curator-entered duty rates this originally rendered are always round,
  // but a computed Decimal (e.g. unit_value_trend's delta_*_pct) can carry
  // far more precision than is ever useful to show.
  const rounded = Math.round(parsed * 100) / 100
  return `${rounded}%`
}

/**
 * Formats a `Decimal`-typed tonnage field (FAOSTAT production figures) with
 * thousands separators. `null` renders as the missing-data marker — for
 * `india_production_tonnes` specifically, this is the exact real case
 * FAOSTAT's own "missing value" flag produces, never a fabricated zero.
 */
export function formatTonnes(value: string | null): string {
  if (value === null) {
    return MISSING_VALUE_DISPLAY
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? `${parsed.toLocaleString('en-IN')} t` : MISSING_VALUE_DISPLAY
}
