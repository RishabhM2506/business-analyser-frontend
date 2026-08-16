import { expect, test } from '@playwright/test'

import {
  E2E_ANALYSIS_ENVELOPE,
  E2E_CATEGORY_QUERY,
  E2E_ITEM_DESCRIPTION,
  E2E_THREAD_ID,
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
    await page.getByRole('combobox', { name: /search hs categories/i }).fill(E2E_CATEGORY_QUERY)
    await page.getByRole('option', { name: /Animals; live/i }).click()
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
