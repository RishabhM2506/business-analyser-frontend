import { expect, test } from '@playwright/test'

import {
  E2E_ANALYSIS_ENVELOPE,
  E2E_ITEM_HS_CODE,
  E2E_THREAD_ID,
  E2E_TRADE_REPORT_RESPONSE,
} from './fixtures'

/**
 * End-to-end walk of the India trade-report pipeline page (2026-08-25
 * addition, `/report/:hsCode`) — the newest, structurally most complex view
 * (its own QueryControls, five conditional card sections, its own focus
 * watcher) and, per the 2026-08-26 whole-repo frontend review, the one
 * feature with no e2e coverage at all before this file: unit specs already
 * cover its rendering logic thoroughly, but this app's own history
 * (useHsTaxonomy's stale-ref bug, the M18 double-click misnavigation, the
 * M12 VirtualList overflow bug) shows real bugs in views this shape tend to
 * be the ones unit tests structurally can't catch. Only the backend HTTP
 * calls are mocked; the real app code (router, stores, components) runs for
 * real.
 */
async function mockThreadCreation(page: import('@playwright/test').Page) {
  await page.route('**/api/threads', async (route) => {
    await route.fulfill({ json: { thread_id: E2E_THREAD_ID } })
  })
}

test.describe('trade-report page', () => {
  test('reachable from the analysis view, renders duty verification distinctly from unverified, and never fabricates a landed cost', async ({
    page,
  }) => {
    await mockThreadCreation(page)
    await page.route(`**/api/threads/${E2E_THREAD_ID}/messages`, async (route) => {
      await route.fulfill({ json: E2E_ANALYSIS_ENVELOPE })
    })
    await page.route(`**/api/threads/${E2E_THREAD_ID}/trade-report`, async (route) => {
      await route.fulfill({ json: E2E_TRADE_REPORT_RESPONSE })
    })

    await page.goto(`/analysis/${E2E_ITEM_HS_CODE}`)
    await expect(page.getByRole('heading', { name: 'Trade analysis' })).toBeVisible()

    await page.getByRole('link', { name: /view duty verification, mandi price/i }).click()

    await expect(page).toHaveURL(new RegExp(`/report/${E2E_ITEM_HS_CODE}$`))
    await expect(page.getByRole('heading', { name: 'Product intelligence' })).toBeVisible()

    // BCD is verified — a real percentage, not a placeholder. Scoped to the
    // duty table's own rate cell: the narrative prose fixture legitimately
    // also contains the substring "30%", so a page-wide text match would be
    // ambiguous.
    await expect(page.getByText('Verified').first()).toBeVisible()
    await expect(page.locator('.duty__rate', { hasText: '30%' })).toBeVisible()

    // AIDC/SWS/IGST are unverified — never rendered as 0%, and the page
    // says so in words. Scoped to the duty summary element — the e2e
    // fixture's own narrative prose also legitimately contains the word
    // "incomplete", so a page-wide text match would be ambiguous.
    await expect(page.getByText('Not verified').first()).toBeVisible()
    await expect(page.locator('.duty__summary--incomplete')).toContainText('incomplete')

    // This commodity (a live animal, HS chapter 01) is not agriculture-
    // relevant for mandi/MSP/FAOSTAT purposes — a single quiet note, not
    // three empty-looking cards.
    await expect(page.getByText(/do not apply to this product category/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Mandi price (Agmarknet)' })).toHaveCount(0)
  })

  test('lets the user change years/top_n and re-queries with the chosen values', async ({
    page,
  }) => {
    await mockThreadCreation(page)
    let lastRequestBody: Record<string, unknown> | undefined
    await page.route(`**/api/threads/${E2E_THREAD_ID}/trade-report`, async (route) => {
      lastRequestBody = route.request().postDataJSON()
      await route.fulfill({ json: E2E_TRADE_REPORT_RESPONSE })
    })

    await page.goto(`/report/${E2E_ITEM_HS_CODE}`)
    await expect(page.getByRole('heading', { name: 'Product intelligence' })).toBeVisible()
    expect(lastRequestBody?.years).toBeUndefined()
    expect(lastRequestBody?.top_n).toBeUndefined()

    await page.getByLabel('Years of history').fill('3')
    await page.getByLabel('Top trading partners').fill('5')
    await page.getByRole('button', { name: 'Apply' }).click()

    await expect.poll(() => lastRequestBody?.years).toBe(3)
    await expect.poll(() => lastRequestBody?.top_n).toBe(5)
  })

  test('a trade-report endpoint error renders an actionable error state, not a blank screen', async ({
    page,
  }) => {
    await mockThreadCreation(page)
    await page.route(`**/api/threads/${E2E_THREAD_ID}/trade-report`, async (route) => {
      await route.fulfill({
        status: 500,
        json: {
          error_code: 'INTERNAL_ERROR',
          message: 'The trade report could not be completed due to an internal error.',
          retryable: false,
          trace_id: 'e2e-trade-report-error',
        },
      })
    })

    await page.goto(`/report/${E2E_ITEM_HS_CODE}`)

    const alert = page.getByRole('alert')
    await expect(alert).toContainText('internal error')
  })
})
