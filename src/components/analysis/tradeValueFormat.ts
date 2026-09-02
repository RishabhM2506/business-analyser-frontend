// Pure display formatting for trade values — split out of TradeTable.vue so
// the one rule that matters most (master brief §2.2: missing data renders as
// "—", never blank, never interpolated) is testable directly against plain
// values, not only indirectly through a mounted component.

export const MISSING_VALUE_DISPLAY = '—'

const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

/**
 * Formats one `CountryRow.values_by_year` cell for display. This never
 * changes *which* number is shown — it only adds thousands separators and a
 * currency symbol to the exact value the backend sent. `null` (Comtrade
 * reported no data for that year) and `undefined` (the year is absent from
 * the map entirely) both render as the missing-data marker: never blank,
 * never a guessed/interpolated figure.
 */
export function formatTradeValue(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return MISSING_VALUE_DISPLAY
  }
  return usdFormatter.format(value)
}

// 2026-09-02, Step 3 hardening: `TradeBalance.by_year`/`.cumulative` — the
// sign itself is the whole point (net importer vs. net exporter), so an
// explicit "+" on a positive value removes any ambiguity a bare formatted
// number could leave (a negative already reads unambiguously via "-").
const signedUsdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  signDisplay: 'exceptZero',
})

export function formatSignedTradeValue(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return MISSING_VALUE_DISPLAY
  }
  return signedUsdFormatter.format(value)
}

const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
})

/** For CAGR (a ratio like 0.082, meaning 8.2%) — structured-display only,
 * never narrated by the LLM (`app.guardrails._FORBIDDEN_SUFFIX_PATTERN`
 * forbids the model from stating any derived percentage; this is a plain
 * UI formatter over a backend-computed number, the same category as
 * `formatTradeValue` itself). */
export function formatCagr(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return MISSING_VALUE_DISPLAY
  }
  return percentFormatter.format(value)
}

const ratioFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** For HHI (0-1 concentration index) — same structured-display-only
 * discipline as `formatCagr`. */
export function formatRatio(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return MISSING_VALUE_DISPLAY
  }
  return ratioFormatter.format(value)
}
