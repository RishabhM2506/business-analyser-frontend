import { expect, test } from '@playwright/test'

import type { ResponseEnvelope } from '../../src/types/generated'
import {
  E2E_ANALYSIS_ENVELOPE,
  E2E_CATEGORY_QUERY,
  E2E_ITEM_DESCRIPTION,
  E2E_THREAD_ID,
  NAVIGATION_LOCKOUT_CLEAR_MS,
} from './fixtures'

/**
 * Regression coverage for Phase 4 finding B6/Frontend-QA#2: the trade-data
 * tables caused real page-level horizontal scroll on a standard 375px mobile
 * viewport with ordinary (non-edge-case) data. Root-caused to
 * `TradeTable.vue`'s `.trade-table__scroll` missing `position: relative`,
 * which let its `position: absolute` visually-hidden descendants (the
 * accessible <caption> and the per-column "(provisional)" <span>) escape its
 * own overflow clipping and leak into the page's real scrollable overflow —
 * see that file's CSS comment for the full mechanism.
 *
 * This is deliberately an e2e test, not a unit test: jsdom performs no real
 * layout, so it cannot compute `scrollWidth`/a real scroll gesture (the
 * exact reason this bug shipped despite passing unit/component tests).
 */
async function mockThreadCreation(page: import('@playwright/test').Page) {
  await page.route('**/api/threads', async (route) => {
    await route.fulfill({ json: { thread_id: E2E_THREAD_ID } })
  })
}

test.describe('mobile viewport — no page-level horizontal scroll', () => {
  test.use({ viewport: { width: 375, height: 800 } })

  test('the analysis view with real trade tables does not cause the page itself to scroll horizontally', async ({
    page,
  }) => {
    await mockThreadCreation(page)
    await page.route(`**/api/threads/${E2E_THREAD_ID}/messages`, async (route) => {
      await route.fulfill({ json: E2E_ANALYSIS_ENVELOPE })
    })

    await page.goto('/')
    await page.getByRole('button', { name: 'Start my process' }).click()
    // 2026-08-20 roadmap decision: "Start my process" now lands on the free-
    // text search screen first — see landing.spec.ts/full-flow.spec.ts for
    // the same fix's rationale.
    await page.getByRole('link', { name: /browse by category instead/i }).click()
    await page.getByRole('combobox', { name: /search hs categories/i }).fill(E2E_CATEGORY_QUERY)
    await page.getByRole('option', { name: /Animals; live/i }).click()
    await expect(page).toHaveURL(/\/categories\/01\/items$/)
    await page.waitForTimeout(NAVIGATION_LOCKOUT_CLEAR_MS) // see fixtures.ts's M18 note
    await page.getByRole('option', { name: new RegExp(E2E_ITEM_DESCRIPTION) }).click()
    await expect(page).toHaveURL(/\/analysis\/010121$/)
    await expect(page.getByRole('heading', { name: 'Imports' })).toBeVisible()

    // The core assertion: the document itself must not be wider than the
    // viewport. Before the fix this measured 730px against a 375px viewport
    // with this exact fixture.
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)

    // A real scroll gesture at the page level must not move the page
    // horizontally at all (matching the master brief's Phase 4.4 method of
    // proving this with an actual gesture, not just a static measurement).
    await page.mouse.move(187, 400)
    await page.mouse.wheel(300, 0)
    await page.waitForTimeout(150)
    const scrollXAfterGesture = await page.evaluate(() => window.scrollX)
    expect(scrollXAfterGesture).toBe(0)

    // The fix must not regress the table's own intentional internal
    // horizontal scroll (`.trade-table__scroll { overflow-x: auto }` is the
    // right call for wide tabular data on narrow viewports — this table
    // should still be able to scroll to reveal later year columns).
    const tableScroll = page.locator('.trade-table__scroll').first()
    const internal = await tableScroll.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }))
    expect(internal.scrollWidth).toBeGreaterThan(internal.clientWidth)
  })
})

/**
 * Regression coverage for Phase 4 finding M12/Frontend-Reviewer#1:
 * `VirtualList`'s fixed-row-height offset math assumes every row is exactly
 * `ITEM_HEIGHT` (48px for categories, 56px for items) tall — real taxonomy
 * descriptions run well past what fits on one line at that height (verified
 * against the real checked-in public/hs-taxonomy.json: category descriptions
 * up to 233 chars, item descriptions up to 255), and nothing enforced a
 * single line before `CategorySearch.vue`/`ItemList.vue` got
 * `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`.
 *
 * This exercises the real, bundled public/hs-taxonomy.json (no mocking of
 * the taxonomy fetch) with two genuine long-description rows picked from
 * that real file, specifically so the rendered row height can be measured
 * for real — jsdom performs no real layout/text-wrapping, so a unit test
 * cannot observe whether a description actually wrapped to multiple lines,
 * only whether the right CSS properties are declared (already covered in
 * CategorySearch.spec.ts/ItemList.spec.ts).
 */
test.describe('virtualized picker rows stay a fixed height with real long descriptions (M12)', () => {
  test('a category with a 233-char real description renders at a single-line row height, not wrapped', async ({
    page,
  }) => {
    await page.goto('/categories')
    const searchInput = page.getByRole('combobox', { name: /search hs categories/i })
    // Chapter 34 in the real taxonomy: "Soap, organic surface-active
    // agents; ..." (233 chars) — the longest level-2 description in the
    // real dataset.
    await searchInput.fill('Soap')
    const option = page.getByRole('option', { name: /Soap, organic surface-active agents/i })
    await expect(option).toBeVisible()

    const height = await option.evaluate((el) => el.getBoundingClientRect().height)
    // ITEM_HEIGHT for categories is 48px — allow a little slack for
    // borders/line-height rounding, but a 2+ line wrap would measure ~80px+.
    expect(height).toBeLessThanOrEqual(56)
  })

  test('an item with a 200+ char real description renders at a single-line row height, not wrapped', async ({
    page,
  }) => {
    // Chapter 17 ("Sugars and sugar confectionery"), item 170240 — a real
    // 202-char description, the 10th item by hs_code sort order in that
    // chapter, safely within VirtualList's initial render window (no
    // scrolling needed to bring it into the DOM).
    await page.goto('/categories/17/items')
    // Two rows share the same description prefix ("170230"/"170240" both
    // start "Sugars; glucose and glucose syrup...") — the hs_code disambiguates.
    const option = page.getByRole('option', { name: /170240/ })
    await expect(option).toBeVisible()

    const height = await option.evaluate((el) => el.getBoundingClientRect().height)
    // ITEM_HEIGHT for items is 56px.
    expect(height).toBeLessThanOrEqual(64)
  })
})

/**
 * Regression coverage for Phase 4 finding M15/Frontend-QA#3: a single long
 * unbroken word in LLM-authored prose (analytical_summary/item_description
 * — the two pieces of content this app generates from a model) overflowed
 * `AnalysisSummary.vue`'s container and the whole page horizontally on a
 * standard desktop viewport, since nothing constrained a run with zero word-
 * break opportunities. Matches the source report's exact reproduction
 * method: a 150+ char unbroken token on a 1280px viewport.
 */
test.describe('a long unbroken word in analysis prose does not overflow the page (M15)', () => {
  test('analytical_summary containing a 204-char unbroken token does not widen the page horizontally', async ({
    page,
  }) => {
    const LONG_TOKEN = 'a'.repeat(204)
    // Narrow the union before spreading `.data` — ResponseEnvelope's other
    // member types it `unknown`, which can't be spread.
    if (E2E_ANALYSIS_ENVELOPE.type !== 'final') {
      throw new Error('Expected E2E_ANALYSIS_ENVELOPE to be a "final" envelope.')
    }
    const envelopeWithLongToken: ResponseEnvelope = {
      type: 'final',
      data: {
        ...E2E_ANALYSIS_ENVELOPE.data,
        analytical_summary: `A single unbroken run follows: ${LONG_TOKEN} — the rest of the sentence continues normally.`,
      },
    }

    await page.route('**/api/threads', async (route) => {
      await route.fulfill({ json: { thread_id: E2E_THREAD_ID } })
    })
    await page.route(`**/api/threads/${E2E_THREAD_ID}/messages`, async (route) => {
      await route.fulfill({ json: envelopeWithLongToken })
    })

    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/')
    await page.getByRole('button', { name: 'Start my process' }).click()
    // 2026-08-20 roadmap decision: "Start my process" now lands on the free-
    // text search screen first — see landing.spec.ts/full-flow.spec.ts for
    // the same fix's rationale.
    await page.getByRole('link', { name: /browse by category instead/i }).click()
    await page.getByRole('combobox', { name: /search hs categories/i }).fill(E2E_CATEGORY_QUERY)
    await page.getByRole('option', { name: /Animals; live/i }).click()
    await expect(page).toHaveURL(/\/categories\/01\/items$/)
    await page.waitForTimeout(NAVIGATION_LOCKOUT_CLEAR_MS) // see fixtures.ts's M18 note
    await page.getByRole('option', { name: new RegExp(E2E_ITEM_DESCRIPTION) }).click()
    await expect(page.getByText(LONG_TOKEN)).toBeVisible()

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })
})
