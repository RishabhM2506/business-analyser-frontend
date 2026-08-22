import { expect, test } from '@playwright/test'

import {
  E2E_COFFEE_ANALYSIS_ENVELOPE,
  E2E_SEARCH_AUTO_SELECTED_RESPONSE,
  E2E_SEARCH_DISAMBIGUATE_RESPONSE,
  E2E_SEARCH_NO_CANDIDATES_RESPONSE,
  E2E_THREAD_ID,
} from './fixtures'

/**
 * End-to-end walk of the free-text product search flow (2026-08-20 roadmap
 * decision): Start → search screen → disambiguate/auto-select → analysis
 * rendered, plus the no-match fallback. Only the backend HTTP calls are
 * mocked; the real app code (router, stores, components) runs for real.
 */
async function mockThreadCreation(page: import('@playwright/test').Page) {
  await page.route('**/api/threads', async (route) => {
    await route.fulfill({ json: { thread_id: E2E_THREAD_ID } })
  })
}

test.describe('free-text product search', () => {
  test('a genuinely ambiguous query shows a disambiguation list; picking a result opens its analysis', async ({
    page,
  }) => {
    await mockThreadCreation(page)
    await page.route(`**/api/threads/${E2E_THREAD_ID}/search`, async (route) => {
      await route.fulfill({ json: E2E_SEARCH_DISAMBIGUATE_RESPONSE })
    })
    await page.route(`**/api/threads/${E2E_THREAD_ID}/messages`, async (route) => {
      await route.fulfill({ json: E2E_COFFEE_ANALYSIS_ENVELOPE })
    })

    await page.goto('/')
    await page.getByRole('button', { name: 'Start my process' }).click()
    await expect(page).toHaveURL(/\/search$/)

    await page.getByLabel('Product description').fill('coffee')
    await page.getByRole('button', { name: 'Search' }).click()

    const results = page.getByRole('listbox', { name: /matching hs product codes/i })
    await expect(results).toBeVisible()
    const options = page.getByRole('option')
    await expect(options).toHaveCount(3)
    await expect(options.first()).toContainText('090111')
    await expect(options.first()).toContainText('62% match')

    await options.first().click()

    await expect(page).toHaveURL(/\/analysis\/090111$/)
    await expect(page.getByRole('heading', { name: 'Trade analysis' })).toBeVisible()
    await expect(page.getByText('HS 090111')).toBeVisible()
  })

  test('a high-confidence query auto-selects and navigates straight to the analysis, skipping disambiguation', async ({
    page,
  }) => {
    await mockThreadCreation(page)
    await page.route(`**/api/threads/${E2E_THREAD_ID}/search`, async (route) => {
      await route.fulfill({ json: E2E_SEARCH_AUTO_SELECTED_RESPONSE })
    })
    await page.route(`**/api/threads/${E2E_THREAD_ID}/messages`, async (route) => {
      await route.fulfill({ json: E2E_COFFEE_ANALYSIS_ENVELOPE })
    })

    await page.goto('/search')
    await page.getByLabel('Product description').fill('green coffee beans')
    await page.getByRole('button', { name: 'Search' }).click()

    await expect(page).toHaveURL(/\/analysis\/090111$/)
    await expect(page.getByRole('heading', { name: 'Trade analysis' })).toBeVisible()
    await expect(page.getByText('HS 090111')).toBeVisible()
  })

  test('a nonsense query shows a "no matches" empty state with a way back to browsing categories', async ({
    page,
  }) => {
    await mockThreadCreation(page)
    await page.route(`**/api/threads/${E2E_THREAD_ID}/search`, async (route) => {
      await route.fulfill({ json: E2E_SEARCH_NO_CANDIDATES_RESPONSE })
    })

    await page.goto('/search')
    await page.getByLabel('Product description').fill('zzzqqqxxx nonsense gibberish')
    await page.getByRole('button', { name: 'Search' }).click()

    await expect(page.getByText('No matching product codes found.').first()).toBeVisible()
    await expect(page.getByRole('option')).toHaveCount(0)
    await expect(page.getByRole('link', { name: /browse by category instead/i })).toBeVisible()
  })

  test('a search-endpoint error renders an actionable error state, not a blank screen', async ({
    page,
  }) => {
    await mockThreadCreation(page)
    await page.route(`**/api/threads/${E2E_THREAD_ID}/search`, async (route) => {
      await route.fulfill({
        status: 429,
        json: {
          error_code: 'BUDGET_EXCEEDED',
          message: 'The model-call budget for this thread or day has been reached.',
          retryable: true,
          trace_id: 'e2e-search-budget',
        },
      })
    })

    await page.goto('/search')
    await page.getByLabel('Product description').fill('coffee')
    await page.getByRole('button', { name: 'Search' }).click()

    const alert = page.getByRole('alert')
    await expect(alert).toContainText('budget')
    await expect(alert.getByRole('button', { name: 'Retry' })).toHaveCount(1)
  })

  test('keyboard-only: type a query, submit, arrow down to a result, Enter opens its analysis', async ({
    page,
  }) => {
    await mockThreadCreation(page)
    await page.route(`**/api/threads/${E2E_THREAD_ID}/search`, async (route) => {
      await route.fulfill({ json: E2E_SEARCH_DISAMBIGUATE_RESPONSE })
    })
    await page.route(`**/api/threads/${E2E_THREAD_ID}/messages`, async (route) => {
      await route.fulfill({ json: E2E_COFFEE_ANALYSIS_ENVELOPE })
    })

    await page.goto('/search')
    const input = page.getByLabel('Product description')
    await input.fill('coffee')
    await input.press('Enter')

    const listbox = page.getByRole('listbox', { name: /matching hs product codes/i })
    await expect(listbox).toBeVisible()
    await listbox.press('ArrowDown')
    await listbox.press('Enter')

    await expect(page).toHaveURL(/\/analysis\/090111$/)
  })
})
