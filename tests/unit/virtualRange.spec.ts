import { describe, expect, it } from 'vitest'

import { computeVirtualRange } from '@/components/common/virtualRange'

describe('computeVirtualRange', () => {
  it('returns an empty range for zero items', () => {
    const range = computeVirtualRange({
      scrollTop: 0,
      viewportHeight: 200,
      itemHeight: 20,
      itemCount: 0,
    })
    expect(range).toEqual({ startIndex: 0, endIndex: -1, offsetTop: 0, totalHeight: 0 })
  })

  it('computes total height as itemCount * itemHeight', () => {
    const range = computeVirtualRange({
      scrollTop: 0,
      viewportHeight: 200,
      itemHeight: 20,
      itemCount: 1000,
    })
    expect(range.totalHeight).toBe(20_000)
  })

  it('renders far fewer rows than the full item count at scrollTop 0', () => {
    const range = computeVirtualRange({
      scrollTop: 0,
      viewportHeight: 200,
      itemHeight: 20,
      itemCount: 1000,
      overscan: 2,
    })
    // 200/20 = 10 visible rows, plus 2 rows of overscan past the end (there's
    // no room for overscan before index 0, so start stays clamped at 0).
    expect(range.startIndex).toBe(0)
    expect(range.endIndex).toBe(12)
    expect(range.endIndex - range.startIndex + 1).toBeLessThan(1000)
  })

  it('shifts the visible window forward as scrollTop increases', () => {
    const range = computeVirtualRange({
      scrollTop: 500,
      viewportHeight: 200,
      itemHeight: 20,
      itemCount: 1000,
      overscan: 2,
    })
    // firstVisible = floor(500/20) = 25; startIndex = 25 - 2 = 23.
    expect(range.startIndex).toBe(23)
    expect(range.offsetTop).toBe(23 * 20)
  })

  it('clamps endIndex at itemCount - 1 near the end of the list', () => {
    const range = computeVirtualRange({
      scrollTop: 19_800,
      viewportHeight: 200,
      itemHeight: 20,
      itemCount: 1000,
      overscan: 4,
    })
    // firstVisible = floor(19800/20) = 990; 990 + 10 (visible) + 4 (overscan)
    // = 1004, which is past the last valid index (999) and must clamp there.
    expect(range.startIndex).toBe(986)
    expect(range.endIndex).toBe(999)
  })

  it('clamps a scrollTop beyond the scrollable area rather than producing a negative or out-of-range window', () => {
    const range = computeVirtualRange({
      scrollTop: 999_999,
      viewportHeight: 200,
      itemHeight: 20,
      itemCount: 100,
    })
    expect(range.startIndex).toBeGreaterThanOrEqual(0)
    expect(range.endIndex).toBeLessThanOrEqual(99)
  })

  it('never returns a startIndex below 0 even with a negative scrollTop', () => {
    const range = computeVirtualRange({
      scrollTop: -50,
      viewportHeight: 200,
      itemHeight: 20,
      itemCount: 100,
    })
    expect(range.startIndex).toBe(0)
  })
})
