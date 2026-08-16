import { describe, expect, it } from 'vitest'

import { formatTradeValue, MISSING_VALUE_DISPLAY } from '@/components/analysis/tradeValueFormat'

describe('formatTradeValue', () => {
  // The one hard correctness rule (master brief §2.2): missing data is
  // visibly missing, never blank, never interpolated.
  it('renders null as the missing-data marker', () => {
    expect(formatTradeValue(null)).toBe('—')
    expect(formatTradeValue(null)).toBe(MISSING_VALUE_DISPLAY)
  })

  it('renders undefined (year absent from the map entirely) as the same missing-data marker', () => {
    expect(formatTradeValue(undefined)).toBe(MISSING_VALUE_DISPLAY)
  })

  it('never renders the missing marker for an actual numeric value, including zero', () => {
    expect(formatTradeValue(0)).not.toBe(MISSING_VALUE_DISPLAY)
    expect(formatTradeValue(0)).toBe('$0.00')
  })

  it('formats a positive value as grouped USD currency without altering the underlying number', () => {
    expect(formatTradeValue(2_505_000)).toBe('$2,505,000.00')
  })

  it('formats a negative value (re-exports/corrections can be negative in trade data) correctly', () => {
    expect(formatTradeValue(-100)).toBe('-$100.00')
  })

  it('preserves decimal precision rather than silently rounding it away', () => {
    expect(formatTradeValue(1234.56)).toBe('$1,234.56')
  })
})
