// Shared, pure keyboard-navigation math for the two single-select
// listbox-style pickers (CategorySearch's combobox popup, ItemList's plain
// listbox). Kept as plain functions rather than a composable: it's UI-support
// logic co-located with VirtualList in components/common/, not a fourth
// composable outside the three docs/PLAN.md §4.2 names.

export const LIST_NAVIGATION_KEYS = ['ArrowDown', 'ArrowUp', 'Home', 'End'] as const

export type ListNavigationKey = (typeof LIST_NAVIGATION_KEYS)[number]

export function isListNavigationKey(key: string): key is ListNavigationKey {
  return (LIST_NAVIGATION_KEYS as readonly string[]).includes(key)
}

/**
 * Computes the next active index for a single-select listbox/combobox given a
 * navigation keypress. Clamps at the boundaries rather than wrapping, matching
 * the WAI-ARIA Authoring Practices listbox pattern. `current === -1` means
 * "nothing active yet" — ArrowDown/ArrowUp then land on the first/last item.
 */
export function nextActiveIndex(current: number, key: ListNavigationKey, count: number): number {
  if (count <= 0) {
    return -1
  }
  switch (key) {
    case 'ArrowDown':
      return current < 0 ? 0 : Math.min(current + 1, count - 1)
    case 'ArrowUp':
      return current < 0 ? count - 1 : Math.max(current - 1, 0)
    case 'Home':
      return 0
    case 'End':
      return count - 1
  }
}
