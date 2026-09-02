import { describe, expect, it } from 'vitest'

import {
  formatInrPaise,
  formatPercent,
  formatTonnes,
  MISSING_VALUE_DISPLAY,
} from '@/components/report/reportValueFormat'

describe('formatInrPaise', () => {
  // D2's "missing != 0" discipline, applied to the frontend: a genuinely
  // unverified/unmatched value must never render as a bare ₹0.
  it('renders null as the missing-data marker', () => {
    expect(formatInrPaise(null)).toBe(MISSING_VALUE_DISPLAY)
  })

  it('never renders the missing marker for an actual numeric value, including zero', () => {
    expect(formatInrPaise(0)).not.toBe(MISSING_VALUE_DISPLAY)
    expect(formatInrPaise(0)).toBe('₹0.00')
  })

  it('converts paise to rupees correctly', () => {
    expect(formatInrPaise(250_000)).toBe('₹2,500.00')
  })

  it('formats with grouped thousands separators', () => {
    expect(formatInrPaise(1_200_000)).toBe('₹12,000.00')
  })
})

describe('formatPercent', () => {
  it('renders null as the missing-data marker, never 0% — the exact distinction the duty evidence model exists to enforce', () => {
    expect(formatPercent(null)).toBe(MISSING_VALUE_DISPLAY)
  })

  it('formats a real Decimal-as-string value_pct', () => {
    expect(formatPercent('20.000')).toBe('20%')
  })

  it('renders a genuine zero percent (a real reported figure) distinctly from missing', () => {
    expect(formatPercent('0')).not.toBe(MISSING_VALUE_DISPLAY)
    expect(formatPercent('0')).toBe('0%')
  })

  it('rounds a high-precision computed Decimal to 2dp instead of showing it raw', () => {
    expect(formatPercent('12.56789')).toBe('12.57%')
  })

  it('renders a negative percent (e.g. a real year-over-year decline) correctly, not as missing', () => {
    expect(formatPercent('-5.234')).toBe('-5.23%')
  })
})

describe('formatTonnes', () => {
  it('renders null as the missing-data marker — FAOSTAT’s real "missing value" flag case', () => {
    expect(formatTonnes(null)).toBe(MISSING_VALUE_DISPLAY)
  })

  it('formats a real Decimal-as-string tonnage with thousands separators', () => {
    expect(formatTonnes('10592.010')).toBe('10,592.01 t')
  })
})
