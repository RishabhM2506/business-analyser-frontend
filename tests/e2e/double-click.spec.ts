import { expect, test } from '@playwright/test'

import { E2E_CATEGORY_QUERY, E2E_THREAD_ID } from './fixtures'

/**
 * Regression coverage for Phase 4 finding M18/Frontend-QA#6: a fast real
 * double-click on a category search result can select an unintended item on
 * the next screen — the second click lands on whatever rendered at that
 * same *screen coordinate* after the first click's navigation, which
 * happens to be the new item list's first row (confirmed empirically:
 * measured only 3px apart at a 375px viewport, since `HsCategoryView`/
 * `HsItemView` share close enough padding/heading structure).
 *
 * Uses two real `page.mouse.click(x, y)` calls at the *same fixed screen
 * coordinates* a short delay apart — matching the source report's own note
 * that this class of bug needs literal coordinate clicks, not two locator
 * clicks (`force: true` locator clicks give misleading results for this
 * specific physics, since Playwright re-resolves the locator's target
 * element on each call rather than firing at a frozen pixel).
 */
test.describe('fast double-click across a navigation boundary (M18)', () => {
  test.use({ viewport: { width: 375, height: 800 } })

  test('a real double-click on a category result does not also select an item on the next screen', async ({
    page,
  }) => {
    await page.route('**/api/threads', async (route) => {
      await route.fulfill({ json: { thread_id: E2E_THREAD_ID } })
    })
    // If the guard fails, the second click would fire a second, unintended
    // POST /messages for an item the user never chose — fail loudly instead
    // of silently rendering whatever the mock returns.
    let messageRequests = 0
    await page.route(`**/api/threads/${E2E_THREAD_ID}/messages`, async (route) => {
      messageRequests += 1
      await route.abort()
    })

    await page.goto('/categories')
    const searchInput = page.getByRole('combobox', { name: /search hs categories/i })
    await searchInput.fill(E2E_CATEGORY_QUERY)
    const categoryOption = page.getByRole('option', { name: /Animals; live/i })
    await expect(categoryOption).toBeVisible()

    const box = await categoryOption.boundingBox()
    if (!box) {
      throw new Error('Expected the category option to have a bounding box.')
    }
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2

    // Two real clicks at the same frozen pixel, ~40ms apart — real
    // double-click physics, not a locator re-resolving its target.
    await page.mouse.click(x, y)
    await page.waitForTimeout(40)
    await page.mouse.click(x, y)

    // Give any stray navigation/request time to happen before asserting
    // it didn't.
    await page.waitForTimeout(300)

    // Must land on the category the user actually clicked, not skip straight
    // into an item's analysis the second click accidentally picked.
    await expect(page).toHaveURL(/\/categories\/01\/items$/)
    expect(messageRequests).toBe(0)
  })
})
