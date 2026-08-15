// Named routes only — never push a raw path string (pattern kept from the
// reference repo, docs/CONVENTIONS.md §3).

export const ROUTE_NAMES = {
  LANDING: 'landing',
  HS_CATEGORY: 'hs-category',
  HS_ITEM: 'hs-item',
  ANALYSIS: 'analysis',
} as const

export type RouteName = (typeof ROUTE_NAMES)[keyof typeof ROUTE_NAMES]

export const ROUTE_PATHS: Record<RouteName, string> = {
  [ROUTE_NAMES.LANDING]: '/',
  [ROUTE_NAMES.HS_CATEGORY]: '/categories',
  [ROUTE_NAMES.HS_ITEM]: '/categories/:categoryCode/items',
  [ROUTE_NAMES.ANALYSIS]: '/analysis/:hsCode',
}
