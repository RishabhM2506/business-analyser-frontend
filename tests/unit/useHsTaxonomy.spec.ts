import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { FIXTURE_TAXONOMY } from '../fixtures/hsTaxonomy'

// useHsTaxonomy holds module-level singleton state deliberately (see the
// file's own comment: loaded once per page session, shared across
// components). That means each test here needs a *genuinely fresh* module
// instance to test loading/caching/error-retry behavior in isolation —
// vi.resetModules() + a dynamic re-import gets a clean singleton per test,
// rather than tests here silently depending on execution order.
async function freshUseHsTaxonomy() {
  vi.resetModules()
  const mod = await import('@/composables/useHsTaxonomy')
  return mod.useHsTaxonomy
}

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: async () => body,
    }),
  )
}

describe('useHsTaxonomy', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts with empty entries and no error before load() is called', async () => {
    const useHsTaxonomy = await freshUseHsTaxonomy()
    mockFetchOnce(FIXTURE_TAXONOMY)
    const { entries, isLoading, error } = useHsTaxonomy()
    expect(entries.value).toEqual([])
    expect(isLoading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('load() fetches the taxonomy JSON and populates entries', async () => {
    const useHsTaxonomy = await freshUseHsTaxonomy()
    mockFetchOnce(FIXTURE_TAXONOMY)
    const { entries, load } = useHsTaxonomy()

    await load()

    expect(entries.value).toHaveLength(FIXTURE_TAXONOMY.length)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('a second load() call does not re-fetch once already loaded', async () => {
    const useHsTaxonomy = await freshUseHsTaxonomy()
    mockFetchOnce(FIXTURE_TAXONOMY)
    const { load } = useHsTaxonomy()

    await load()
    await load()

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('concurrent load() calls share a single in-flight fetch', async () => {
    const useHsTaxonomy = await freshUseHsTaxonomy()
    mockFetchOnce(FIXTURE_TAXONOMY)
    const { load } = useHsTaxonomy()

    await Promise.all([load(), load(), load()])

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('a fresh useHsTaxonomy() call returns the same shared state (singleton, not per-call)', async () => {
    const useHsTaxonomy = await freshUseHsTaxonomy()
    mockFetchOnce(FIXTURE_TAXONOMY)

    await useHsTaxonomy().load()
    const second = useHsTaxonomy()

    expect(second.entries.value).toHaveLength(FIXTURE_TAXONOMY.length)
  })

  it('sets error and clears entries when the fetch response is not ok', async () => {
    const useHsTaxonomy = await freshUseHsTaxonomy()
    mockFetchOnce({}, false, 404)
    const { entries, error, load } = useHsTaxonomy()

    await expect(load()).rejects.toThrow()
    expect(error.value).not.toBeNull()
    expect(error.value?.message).toContain('404')
    expect(entries.value).toEqual([])
  })

  it('times out and sets a timeout-specific error if the taxonomy fetch hangs (M13)', async () => {
    // Regression test for Phase 4 finding M13/Frontend-Reviewer#2: the
    // taxonomy fetch previously had no timeout at all — a stalled connection
    // on this 1.2MB file left `isLoading` true forever with no escape (the
    // ErrorState/Retry path only appears once `error.value` is set, which a
    // hang never triggers). Uses fake timers to simulate a hang without a
    // real 15s wait; the mock `fetch` only ever settles when the
    // AbortController's signal actually fires, matching real `fetch`
    // behavior under an abort.
    vi.useFakeTimers()
    try {
      const useHsTaxonomy = await freshUseHsTaxonomy()
      vi.stubGlobal(
        'fetch',
        vi.fn((_url: string, options?: { signal?: AbortSignal }) => {
          return new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => {
              const abortError = new Error('The operation was aborted.')
              abortError.name = 'AbortError'
              reject(abortError)
            })
          })
        }),
      )
      const { error, isLoading, load } = useHsTaxonomy()

      const loadPromise = load()
      expect(isLoading.value).toBe(true)
      // Attach the rejection assertion *before* advancing timers so a
      // handler exists the instant the promise actually settles — otherwise
      // there's a brief window between the abort firing (inside
      // advanceTimersByTimeAsync) and this test attaching `.rejects` that
      // Node flags as an unhandled rejection, even though it is handled
      // moments later.
      const assertion = expect(loadPromise).rejects.toThrow(/timed out/i)

      await vi.advanceTimersByTimeAsync(15_000)
      await assertion

      expect(error.value?.message).toMatch(/timed out/i)
      expect(isLoading.value).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('allows retrying load() after a failure (does not permanently latch the failed promise)', async () => {
    const useHsTaxonomy = await freshUseHsTaxonomy()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => FIXTURE_TAXONOMY }),
    )
    const { entries, error, load } = useHsTaxonomy()

    await expect(load()).rejects.toThrow()
    expect(error.value).not.toBeNull()

    await load()
    expect(error.value).toBeNull()
    expect(entries.value).toHaveLength(FIXTURE_TAXONOMY.length)
  })

  describe('search', () => {
    it('returns only level-2 categories, matched by description, for a text query', async () => {
      const useHsTaxonomy = await freshUseHsTaxonomy()
      mockFetchOnce(FIXTURE_TAXONOMY)
      const { load, search } = useHsTaxonomy()
      await load()

      const results = search('animals')
      expect(results.length).toBeGreaterThan(0)
      expect(results.every((entry) => entry.level === 2)).toBe(true)
      expect(results.some((entry) => entry.hs_code === '01')).toBe(true)
    })

    it('is case-insensitive', async () => {
      const useHsTaxonomy = await freshUseHsTaxonomy()
      mockFetchOnce(FIXTURE_TAXONOMY)
      const { load, search } = useHsTaxonomy()
      await load()

      expect(search('ANIMALS').some((entry) => entry.hs_code === '01')).toBe(true)
    })

    it('returns all categories, sorted by code, for an empty/whitespace query', async () => {
      const useHsTaxonomy = await freshUseHsTaxonomy()
      mockFetchOnce(FIXTURE_TAXONOMY)
      const { load, search } = useHsTaxonomy()
      await load()

      const results = search('   ')
      const expectedCodes = FIXTURE_TAXONOMY.filter((e) => e.level === 2)
        .map((e) => e.hs_code)
        .sort()
      expect(results.map((entry) => entry.hs_code)).toEqual(expectedCodes)
    })

    it('returns an empty array for a query matching nothing', async () => {
      const useHsTaxonomy = await freshUseHsTaxonomy()
      mockFetchOnce(FIXTURE_TAXONOMY)
      const { load, search } = useHsTaxonomy()
      await load()

      expect(search('zzz_no_such_category_zzz')).toEqual([])
    })

    it('returns an empty array when called before load() resolves', async () => {
      const useHsTaxonomy = await freshUseHsTaxonomy()
      mockFetchOnce(FIXTURE_TAXONOMY)
      const { search } = useHsTaxonomy()

      expect(search('animals')).toEqual([])
    })

    // Regression test for a real bug caught by e2e testing (not by any other
    // unit test here, since they all `await load()` before ever calling
    // search()): a reactive `computed(() => search(query))` evaluated *while
    // the index was still loading* got permanently stuck on its empty result
    // even after loading finished, because the index readiness state wasn't
    // a Vue ref — reassigning it was invisible to the computed's dependency
    // tracking, so nothing ever told it to re-run.
    it('a computed wrapping search() picks up the finished index without the query itself changing', async () => {
      const useHsTaxonomy = await freshUseHsTaxonomy()
      let resolveFetch: (value: unknown) => void = () => {}
      vi.stubGlobal(
        'fetch',
        vi.fn().mockReturnValue(new Promise((resolve) => (resolveFetch = resolve))),
      )
      const { search, load } = useHsTaxonomy()

      const results = computed(() => search('animals'))
      // Reading .value now, before load() resolves, is what registers
      // useHsTaxonomy's internal index state as this computed's dependency —
      // exactly the sequence a component's template triggers in practice.
      expect(results.value).toEqual([])

      const loadPromise = load()
      resolveFetch({ ok: true, status: 200, json: async () => FIXTURE_TAXONOMY })
      await loadPromise

      // No re-read of `query` happened — only the index finished loading.
      expect(results.value.map((entry) => entry.hs_code)).toContain('01')
    })
  })

  describe('getItemsForCategory', () => {
    it('returns only level-6 items whose code is nested under the given level-2 category', async () => {
      const useHsTaxonomy = await freshUseHsTaxonomy()
      mockFetchOnce(FIXTURE_TAXONOMY)
      const { load, getItemsForCategory } = useHsTaxonomy()
      await load()

      const items = getItemsForCategory('01')
      expect(items.map((entry) => entry.hs_code)).toEqual(['010121', '010129'])
      expect(items.every((entry) => entry.level === 6)).toBe(true)
    })

    it('does not use the parent field directly (level-6 parent points at the level-4 heading, not the level-2 chapter)', async () => {
      const useHsTaxonomy = await freshUseHsTaxonomy()
      mockFetchOnce(FIXTURE_TAXONOMY)
      const { load, getItemsForCategory } = useHsTaxonomy()
      await load()

      // Sanity check against the fixture itself: no level-6 row has parent === '01'.
      expect(FIXTURE_TAXONOMY.some((e) => e.level === 6 && e.parent === '01')).toBe(false)
      // Yet getItemsForCategory('01') must still find them via hs_code prefix nesting.
      expect(getItemsForCategory('01')).toHaveLength(2)
    })

    it('returns items for a different category without cross-contamination', async () => {
      const useHsTaxonomy = await freshUseHsTaxonomy()
      mockFetchOnce(FIXTURE_TAXONOMY)
      const { load, getItemsForCategory } = useHsTaxonomy()
      await load()

      expect(getItemsForCategory('16').map((entry) => entry.hs_code)).toEqual(['160100'])
    })

    it('returns an empty array for a category with no items / an unknown code', async () => {
      const useHsTaxonomy = await freshUseHsTaxonomy()
      mockFetchOnce(FIXTURE_TAXONOMY)
      const { load, getItemsForCategory } = useHsTaxonomy()
      await load()

      expect(getItemsForCategory('99')).toEqual([])
    })
  })
})
