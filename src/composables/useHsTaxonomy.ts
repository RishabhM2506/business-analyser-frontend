import { type Ref } from 'vue'

/**
 * One entry from the bundled `public/hs-taxonomy.json` search index — built
 * from the same public-domain source the backend uses
 * (`datasets/harmonized-system`, ODC-PDDL, docs/PLAN.md Gate 0 finding).
 * `level` is numeric in the source data: 2 = chapter, 4 = heading,
 * 6 = subheading (HS6 — what `TradeQuery.hs_code` is validated against).
 * There is no separate section-level row; `section` (a roman-numeral code,
 * e.g. "I") is a grouping column present on every row instead.
 */
export interface HsTaxonomyEntry {
  hs_code: string
  description: string
  level: 2 | 4 | 6
  section: string
  parent: string
}

export interface UseHsTaxonomyReturn {
  entries: Ref<HsTaxonomyEntry[]>
  isLoading: Ref<boolean>
  error: Ref<Error | null>
  /** Client-side search — zero model calls (master brief §7.3). */
  search: (query: string) => HsTaxonomyEntry[]
  load: () => Promise<void>
}

// TODO(Phase 3): fetch `public/hs-taxonomy.json`, build a MiniSearch index
// over it, and implement `search()`/`load()` against that index.
export function useHsTaxonomy(): UseHsTaxonomyReturn {
  throw new Error('not implemented')
}
