import { expect, test } from '@playwright/test'

import {
  E2E_ANALYSIS_ENVELOPE,
  E2E_CATEGORY_QUERY,
  E2E_ITEM_DESCRIPTION,
  E2E_THREAD_ID,
  NAVIGATION_LOCKOUT_CLEAR_MS,
} from './fixtures'

/**
 * Regression coverage for Phase 4 finding M17/Frontend-QA#5: SPA route
 * transitions performed zero focus management. The source report traced
 * `document.activeElement` live via keyboard and found it landed on `<body>`
 * (nothing) immediately after navigating to AnalysisView, with no
 * `aria-live` announcement anywhere either — on every single route change in
 * the app, not an edge case.
 */
test.describe('focus management on route change (M17)', () => {
  test("focus moves to the new view's heading (not <body>/wherever it was) on every navigation, and the live region announces each one", async ({
    page,
  }) => {
    await page.route('**/api/threads', async (route) => {
      await route.fulfill({ json: { thread_id: E2E_THREAD_ID } })
    })
    await page.route(`**/api/threads/${E2E_THREAD_ID}/messages`, async (route) => {
      await route.fulfill({ json: E2E_ANALYSIS_ENVELOPE })
    })

    const liveRegion = page.locator('[role="status"][aria-live="polite"]').first()

    // Landing
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Business Analyser' })).toBeVisible()

    // Landing -> Search (2026-08-20 roadmap decision: the new primary flow)
    await page.getByRole('button', { name: 'Start my process' }).click()
    await expect(page).toHaveURL(/\/search$/)
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('H1')
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.textContent))
      .toBe('What product are you analyzing?')
    await expect(liveRegion).toHaveText(/search for a product/i)

    // Search -> Categories (the "browse instead" fallback link)
    await page.getByRole('link', { name: /browse by category instead/i }).click()
    await expect(page).toHaveURL(/\/categories$/)
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('H1')
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.textContent))
      .toBe('Choose a category')
    await expect(liveRegion).toHaveText(/Choose a category/)

    // Categories -> Items
    await page.getByRole('combobox', { name: /search hs categories/i }).fill(E2E_CATEGORY_QUERY)
    await page.getByRole('option', { name: /Animals; live/i }).click()
    await expect(page).toHaveURL(/\/items$/)
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('H1')
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.textContent))
      .toBe('Animals; live')

    // Items -> Analysis (heading only exists once loading finishes). See
    // fixtures.ts's NAVIGATION_LOCKOUT_CLEAR_MS doc comment (M18): this is a
    // second, separate, deliberate selection, not a double-click echo.
    await page.waitForTimeout(NAVIGATION_LOCKOUT_CLEAR_MS)
    await page.getByRole('option', { name: new RegExp(E2E_ITEM_DESCRIPTION) }).click()
    await expect(page).toHaveURL(/\/analysis\//)
    await expect(page.getByRole('heading', { name: /trade analysis/i })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('H1')
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.textContent))
      .toMatch(/trade analysis/i)
  })
})
