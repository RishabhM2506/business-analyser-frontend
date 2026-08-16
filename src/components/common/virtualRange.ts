// Pure windowing math for VirtualList.vue, deliberately split out of the
// component so it's testable with plain values — no DOM, no jsdom layout
// quirks (jsdom never computes real geometry, so a component-only test could
// never actually exercise this logic against varied inputs).

export interface VirtualRange {
  /** Index (inclusive) of the first row to render. */
  startIndex: number
  /** Index (inclusive) of the last row to render. `-1` when there is nothing to render. */
  endIndex: number
  /** Pixel offset to translate the rendered window down by, so it lines up with `startIndex`. */
  offsetTop: number
  /** Total scrollable height if every row were rendered — drives the scrollbar. */
  totalHeight: number
}

export interface VirtualRangeParams {
  scrollTop: number
  viewportHeight: number
  itemHeight: number
  itemCount: number
  /** Extra rows rendered outside the visible viewport on each side, to absorb fast scrolling. */
  overscan?: number
}

const DEFAULT_OVERSCAN = 4

export function computeVirtualRange(params: VirtualRangeParams): VirtualRange {
  const { scrollTop, viewportHeight, itemHeight, itemCount, overscan = DEFAULT_OVERSCAN } = params

  if (itemCount <= 0 || itemHeight <= 0) {
    return { startIndex: 0, endIndex: -1, offsetTop: 0, totalHeight: 0 }
  }

  const totalHeight = itemCount * itemHeight
  const clampedScrollTop = Math.max(0, Math.min(scrollTop, totalHeight))
  const firstVisible = Math.floor(clampedScrollTop / itemHeight)
  const visibleCount = Math.ceil(Math.max(viewportHeight, 0) / itemHeight)

  const startIndex = Math.max(0, firstVisible - overscan)
  const endIndex = Math.min(itemCount - 1, firstVisible + visibleCount + overscan)

  return {
    startIndex,
    endIndex,
    offsetTop: startIndex * itemHeight,
    totalHeight,
  }
}
