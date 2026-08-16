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
