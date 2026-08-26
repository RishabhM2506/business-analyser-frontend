// Named routes only — never push a raw path string (pattern kept from the
// reference repo, docs/CONVENTIONS.md §3).

export const ROUTE_NAMES = {
  LANDING: 'landing',
  HS_CATEGORY: 'hs-category',
  HS_ITEM: 'hs-item',
  ANALYSIS: 'analysis',
  PRODUCT_SEARCH: 'product-search',
  TRADE_REPORT: 'trade-report',
} as const

export type RouteName = (typeof ROUTE_NAMES)[keyof typeof ROUTE_NAMES]

export const ROUTE_PATHS: Record<RouteName, string> = {
  [ROUTE_NAMES.LANDING]: '/',
  [ROUTE_NAMES.HS_CATEGORY]: '/categories',
  [ROUTE_NAMES.HS_ITEM]: '/categories/:categoryCode/items',
  [ROUTE_NAMES.ANALYSIS]: '/analysis/:hsCode',
  // A genuine new entry point alongside (not replacing) the category/item
  // picker, which stays as the fallback for `no_candidates_found` and as a
  // browse-first alternative (2026-08-20 roadmap decision).
  [ROUTE_NAMES.PRODUCT_SEARCH]: '/search',
  // Additive alongside ANALYSIS (which renders TradeAnalysisResponse's
  // UN-Comtrade-only view) — this route renders the India trade-report
  // pipeline's own facts (duty verification, mandi price, MSP,
  // international production), 2026-08-25 addition.
  [ROUTE_NAMES.TRADE_REPORT]: '/report/:hsCode',
}
