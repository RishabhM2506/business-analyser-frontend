import { expect, test } from '@playwright/test'

test.describe('landing page', () => {
  test('loads and shows the entry point', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Business Analyser' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start my process' })).toBeVisible()
  })

  test('clicking "Start my process" navigates to the category picker', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Start my process' }).click()

    await expect(page).toHaveURL(/\/categories$/)
    await expect(page.getByRole('heading', { name: 'HsCategoryView' })).toBeVisible()
  })
})
