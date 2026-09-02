import { expect, test } from '@playwright/test'

import {
  E2E_ANALYSIS_ENVELOPE,
  E2E_BUDGET_EXCEEDED_ENVELOPE,
  E2E_CATEGORY_QUERY,
  E2E_ITEM_DESCRIPTION,
  E2E_THREAD_ID,
  NAVIGATION_LOCKOUT_CLEAR_MS,
} from './fixtures'

/**
 * End-to-end walk of the entire v1 user journey (master brief §2.1): Start →
 * HS category search → item select → analysis rendered as a chat result.
 * Exercises the real, bundled public/hs-taxonomy.json (a real category and
 * item from that file — see fixtures.ts) end to end; only the backend HTTP
 * calls are mocked, since the backend isn't reachable while building this
 * slice. A separate docker-compose-based pass verifies the real backend
 * contract later.
 */
async function mockThreadCreation(page: import('@playwright/test').Page) {
  await page.route('**/api/threads', async (route) => {
    await route.fulfill({ json: { thread_id: E2E_THREAD_ID } })
  })
}

test.describe('full analysis flow', () => {
  test('search a category, pick an item, and see the rendered analysis', async ({ page }) => {
    await mockThreadCreation(page)
    await page.route(`**/api/threads/${E2E_THREAD_ID}/messages`, async (route) => {
      await route.fulfill({ json: E2E_ANALYSIS_ENVELOPE })
    })

    await page.goto('/')
    await page.getByRole('button', { name: 'Start my process' }).click()
    // 2026-08-20 roadmap decision: "Start my process" now lands on the new
    // free-text search screen first — this spec exercises the category/item
    // browse path specifically, so it follows the "Browse by category
    // instead" link straight through, same as a real user choosing that path.
    await expect(page).toHaveURL(/\/search$/)
    await page.getByRole('link', { name: /browse by category instead/i }).click()
    await expect(page).toHaveURL(/\/categories$/)

    const searchInput = page.getByRole('combobox', { name: /search hs categories/i })
    await searchInput.fill(E2E_CATEGORY_QUERY)
    const categoryOption = page.getByRole('option', { name: /Animals; live/i })
    await expect(categoryOption).toBeVisible()
    await categoryOption.click()

    await expect(page).toHaveURL(/\/categories\/01\/items$/)
    await expect(page.getByRole('heading', { name: 'Animals; live' })).toBeVisible()

    // See fixtures.ts's NAVIGATION_LOCKOUT_CLEAR_MS doc comment (M18): a
    // real user picking a category then an item is two separate, deliberate
    // choices, not a double-click echo — wait past the lockout so this
    // realistic sequential flow isn't mistaken for the bug it guards against.
    await page.waitForTimeout(NAVIGATION_LOCKOUT_CLEAR_MS)
    const itemOption = page.getByRole('option', { name: new RegExp(E2E_ITEM_DESCRIPTION) })
    await expect(itemOption).toBeVisible()
    await itemOption.click()

    await expect(page).toHaveURL(/\/analysis\/010121$/)

    // Item description and analytical summary — plain structured text.
    await expect(page.getByText('What this item is')).toBeVisible()
    await expect(page.getByText(/Live, pure-bred breeding horses/)).toBeVisible()
    await expect(page.getByText(/Imports were led by the United States/)).toBeVisible()

    // Both trade tables, with real formatted figures straight from the fixture.
    await expect(page.getByRole('heading', { name: 'Imports' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Exports' })).toBeVisible()
    await expect(page.getByText('$2,025,000.00')).toBeVisible() // US cumulative_5yr, imports

    // Missing data (2023 for the US row) must render as the dash marker, never
    // blank. Scoped to `td` and the specific 2023 column position (not just
    // "any dash in the row") — the newer CAGR/Volatility columns can also
    // legitimately show a dash for a value this older fixture doesn't set,
    // which would otherwise make a same-row, any-cell match ambiguous.
    const importsTable = page.locator('table').filter({ hasText: 'United States' })
    const usRow = importsTable.locator('tr').filter({ hasText: 'United States' })
    const usCells = usRow.locator('td')
    // Columns: rank, country, 2021, 2022, 2023, 2024, 2025, 5-yr total, ...
    await expect(usCells.nth(4)).toHaveText('—')

    // Provenance: source, currency, and the explicit calendar-year-vs-fiscal-year note.
    await expect(page.getByText('UN Comtrade (comtradeapi.un.org)')).toBeVisible()
    await expect(page.getByText(/Calendar year/)).toBeVisible()
    await expect(page.getByText(/fiscal year/)).toBeVisible()
  })

  test('a budget-exhaustion error from the backend renders an actionable error state with real (retryable) semantics, not a bare dead-end Retry', async ({
    page,
  }) => {
    // Regression test for M19/Frontend-QA#7 and B1/ARCH-01 together: the
    // fixture is both (a) enveloped exactly like the real backend wraps
    // every POST /threads/{id}/messages response, success or error
    // (docs/PLAN.md §3.3), and (b) retryable:true, matching the real
    // backend's actual BUDGET_EXCEEDED construction — this spec used to
    // assert the opposite of both.
    await mockThreadCreation(page)
    await page.route(`**/api/threads/${E2E_THREAD_ID}/messages`, async (route) => {
      await route.fulfill({ status: 429, json: E2E_BUDGET_EXCEEDED_ENVELOPE })
    })

    await page.goto('/')
    await page.getByRole('button', { name: 'Start my process' }).click()
    await expect(page).toHaveURL(/\/search$/)
    await page.getByRole('link', { name: /browse by category instead/i }).click()
    await expect(page).toHaveURL(/\/categories$/)
    await page.getByRole('combobox', { name: /search hs categories/i }).fill(E2E_CATEGORY_QUERY)
    await page.getByRole('option', { name: /Animals; live/i }).click()
    await expect(page).toHaveURL(/\/categories\/01\/items$/)
    await page.waitForTimeout(NAVIGATION_LOCKOUT_CLEAR_MS) // see M18 note above
    await page.getByRole('option', { name: new RegExp(E2E_ITEM_DESCRIPTION) }).click()

    const alert = page.getByRole('alert')
    await expect(alert).toContainText('usage limit')
    // BUDGET_EXCEEDED is retryable:true on the real wire — the button IS
    // offered, but bare "Retry" with no context is poor UX for a shared
    // daily-limit error, so explanatory copy must accompany it.
    await expect(alert.getByRole('button', { name: 'Retry' })).toHaveCount(1)
    await expect(alert).toContainText('shared across all users')
    await expect(alert).toContainText('tomorrow')
    // The user is never stuck: the persistent breadcrumb is still there.
    await expect(page.getByRole('link', { name: /back to categories/i })).toBeVisible()
  })

  test('keyboard-only category search: type, arrow down, Enter selects without a mouse', async ({
    page,
  }) => {
    await mockThreadCreation(page)
    await page.route(`**/api/threads/${E2E_THREAD_ID}/messages`, async (route) => {
      await route.fulfill({ json: E2E_ANALYSIS_ENVELOPE })
    })

    await page.goto('/categories')
    const searchInput = page.getByRole('combobox', { name: /search hs categories/i })
    await searchInput.fill(E2E_CATEGORY_QUERY)
    // Wait for the actual precondition (the taxonomy fetch + index build has
    // finished and produced a visible result) rather than assuming fill()
    // implies readiness — a real user can't press ArrowDown before seeing
    // the dropdown populate, but automation can outrun the async load.
    await expect(page.getByRole('option', { name: /Animals; live/i })).toBeVisible()
    await searchInput.press('ArrowDown')
    await searchInput.press('Enter')

    await expect(page).toHaveURL(/\/categories\/01\/items$/)
  })
})
