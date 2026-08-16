import { ref, shallowRef, type Ref } from 'vue'

import MiniSearch, { type SearchResult } from 'minisearch'

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
  /**
   * HS6 items (level 6) that live under the given level-2 category code.
   * Deliberately not a `parent`-field lookup: `parent` only points at the
   * *immediate* parent (a level-6 row's `parent` is its level-4 heading, not
   * the level-2 chapter), confirmed against the checked-in data. HS codes are
   * structurally prefix-nested — level-6 code i.e. `010121` always begins
   * with its level-4 heading (`0101`), which always begins with its level-2
   * chapter (`01`) — so a plain prefix filter is both simpler than walking
   * the two-hop parent chain and exactly equivalent to it, with no index
   * required (master brief §3 Phase 3 slice 1: "no search index needed for
   * that step").
   */
  getItemsForCategory: (categoryCode: string) => HsTaxonomyEntry[]
}

const TAXONOMY_URL = `${import.meta.env.BASE_URL}hs-taxonomy.json`
const CATEGORY_LEVEL = 2
const ITEM_LEVEL = 6

// Module-level singleton state: the taxonomy (~1.2MB, 6,939 rows) and its
// search index are loaded and built once per page session, then shared by
// every component that calls useHsTaxonomy() (CategorySearch loads it,
// ItemList/HsItemView reuse it without re-fetching or re-indexing — and
// defensively re-trigger load() themselves in case a user deep-links
// straight into the item view before CategorySearch ever mounted).
const entries = ref<HsTaxonomyEntry[]>([])
const isLoading = ref(false)
const error = ref<Error | null>(null)
// shallowRef, not a plain variable: `search()` reads this inside components'
// `computed(() => search(query.value))`. A plain closure variable's
// reassignment is invisible to Vue's dependency tracking — a real bug caught
// by e2e testing (not unit tests, which awaited the mocked fetch to resolve
// *before* ever calling search()): a user typing a query while the index was
// still loading got stuck on a stale, empty result even after loading
// finished, because nothing signaled the computed to re-run. A ref fixes
// that at the root — its value read is a tracked dependency like any other.
const miniSearch = shallowRef<MiniSearch<HsTaxonomyEntry> | null>(null)
let loadPromise: Promise<void> | null = null

function toEntry(result: SearchResult): HsTaxonomyEntry {
  return {
    hs_code: String(result.hs_code),
    description: String(result.description),
    level: Number(result.level) as 2 | 4 | 6,
    section: String(result.section),
    parent: String(result.parent),
  }
}

function sortByCode(a: HsTaxonomyEntry, b: HsTaxonomyEntry): number {
  return a.hs_code.localeCompare(b.hs_code)
}

async function fetchTaxonomy(): Promise<void> {
  isLoading.value = true
  error.value = null
  try {
    const response = await fetch(TAXONOMY_URL)
    if (!response.ok) {
      throw new Error(`Failed to load HS taxonomy data (HTTP ${response.status}).`)
    }
    const data = (await response.json()) as HsTaxonomyEntry[]

    const index = new MiniSearch<HsTaxonomyEntry>({
      idField: 'hs_code',
      fields: ['description', 'hs_code'],
      storeFields: ['hs_code', 'description', 'level', 'section', 'parent'],
      searchOptions: {
        prefix: true,
        fuzzy: 0.2,
        boost: { description: 2 },
      },
    })
    index.addAll(data.filter((entry) => entry.level === CATEGORY_LEVEL))

    entries.value = data
    miniSearch.value = index
  } catch (caught) {
    error.value = caught instanceof Error ? caught : new Error('Failed to load HS taxonomy data.')
    entries.value = []
    miniSearch.value = null
    throw error.value
  } finally {
    isLoading.value = false
  }
}

/** Idempotent: concurrent/repeated calls share one in-flight fetch, and a resolved load is never re-fetched. */
function load(): Promise<void> {
  if (entries.value.length > 0) {
    return Promise.resolve()
  }
  if (!loadPromise) {
    loadPromise = fetchTaxonomy().catch((caught: unknown) => {
      // Allow a future retry (e.g. the user clicking "Retry") to actually re-fetch.
      loadPromise = null
      throw caught
    })
  }
  return loadPromise
}

/**
 * Searches level-2 category entries only. An empty/whitespace-only query
 * returns the full category list (sorted) rather than nothing, so the picker
 * is browsable before the user types anything.
 */
function search(query: string): HsTaxonomyEntry[] {
  const trimmed = query.trim()
  if (!trimmed) {
    return entries.value.filter((entry) => entry.level === CATEGORY_LEVEL).sort(sortByCode)
  }
  if (!miniSearch.value) {
    return []
  }
  return miniSearch.value.search(trimmed).map(toEntry)
}

function getItemsForCategory(categoryCode: string): HsTaxonomyEntry[] {
  return entries.value
    .filter((entry) => entry.level === ITEM_LEVEL && entry.hs_code.startsWith(categoryCode))
    .sort(sortByCode)
}

export function useHsTaxonomy(): UseHsTaxonomyReturn {
  return { entries, isLoading, error, search, load, getItemsForCategory }
}
