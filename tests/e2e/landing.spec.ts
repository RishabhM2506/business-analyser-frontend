import { expect, test } from '@playwright/test'

import { E2E_THREAD_ID } from './fixtures'

test.describe('landing page', () => {
  test('loads and shows the entry point', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Business Analyser' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start my process' })).toBeVisible()
  })

  test('clicking "Start my process" creates a thread and navigates to the category picker', async ({
    page,
  }) => {
    await page.route('**/api/threads', async (route) => {
      expect(route.request().method()).toBe('POST')
      await route.fulfill({ json: { thread_id: E2E_THREAD_ID } })
    })

    await page.goto('/')
    await page.getByRole('button', { name: 'Start my process' }).click()

    await expect(page).toHaveURL(/\/categories$/)
    await expect(page.getByRole('heading', { name: 'Choose a category' })).toBeVisible()
  })

  test('a failed thread creation shows an actionable error, not a blank screen, and does not navigate away', async ({
    page,
  }) => {
    await page.route('**/api/threads', async (route) => {
      await route.fulfill({
        status: 500,
        json: {
          error_code: 'UNKNOWN_ERROR',
          message: 'Something went wrong. Please try again.',
          retryable: true,
          trace_id: 't1',
        },
      })
    })

    await page.goto('/')
    await page.getByRole('button', { name: 'Start my process' }).click()

    await expect(page.getByRole('alert')).toContainText('Something went wrong')
    await expect(page).toHaveURL('/')
  })
})
