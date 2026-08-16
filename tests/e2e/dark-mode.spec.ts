import { expect, test } from '@playwright/test'

import { E2E_THREAD_ID } from './fixtures'

/**
 * Regression coverage for Phase 4 finding M16/Frontend-QA#4: three real
 * WCAG AA contrast failures, all dark-mode-only (error text 2.29:1, themed
 * breadcrumb links 2.66:1, unstyled default-blue links 1.90:1) — invisible
 * to a light-mode-only review since `--color-danger`/`--color-primary`
 * weren't redefined in tokens.css's dark-mode `@media` block, and two
 * specific `<RouterLink>`s had no explicit class at all.
 *
 * This computes contrast from colors read off the real rendered DOM under
 * actual `colorScheme: 'dark'` emulation (Playwright's `test.use`), not just
 * the token file — matching the source report's own method, specifically so
 * this can't pass against a token value that some other CSS rule quietly
 * overrides at render time.
 */
function relLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const cs = c / 255
    return cs <= 0.03928 ? cs / 12.92 : ((cs + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * (rs ?? 0) + 0.7152 * (gs ?? 0) + 0.0722 * (bs ?? 0)
}

function parseRgb(value: string): [number, number, number] {
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value)
  if (!match) {
    throw new Error(`Could not parse computed color: "${value}"`)
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relLuminance(parseRgb(fg))
  const l2 = relLuminance(parseRgb(bg))
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (lighter + 0.05) / (darker + 0.05)
}

const AA_NORMAL_TEXT_MINIMUM = 4.5

test.describe('dark mode — WCAG AA text contrast', () => {
  test.use({ colorScheme: 'dark' })

  test('error alert text meets AA contrast against its error background', async ({ page }) => {
    await page.route('**/api/threads', (route) =>
      route.fulfill({
        status: 500,
        json: {
          error_code: 'INTERNAL_ERROR',
          message: 'Simulated error for contrast verification.',
          retryable: true,
          trace_id: 't1',
        },
      }),
    )

    await page.goto('/')
    await page.getByRole('button', { name: 'Start my process' }).click()
    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()

    const { color, backgroundColor } = await alert.evaluate((el) => {
      const style = getComputedStyle(el)
      return { color: style.color, backgroundColor: style.backgroundColor }
    })
    expect(contrastRatio(color, backgroundColor)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_MINIMUM)
  })

  test('the breadcrumb link and an unstyled default RouterLink both meet AA contrast against the page background', async ({
    page,
  }) => {
    await page.route('**/api/threads', (route) =>
      route.fulfill({ json: { thread_id: E2E_THREAD_ID } }),
    )
    await page.route(`**/api/threads/${E2E_THREAD_ID}/messages`, (route) =>
      route.fulfill({
        status: 400,
        json: {
          error_code: 'INVALID_HS_CODE',
          message: 'That item code is not recognized.',
          retryable: false,
          trace_id: 't1',
        },
      }),
    )

    await page.goto(`/analysis/010121`)
    // "← Back to categories" (a themed link, previously --color-primary) and
    // "Choose a different category" (ErrorState's default slot, previously
    // entirely unstyled — falls through to the new global `a` rule) are both
    // visible together on this exact error state.
    const breadcrumbLink = page.getByRole('link', { name: /back to categories/i })
    const escapeHatchLink = page.getByRole('link', { name: /choose a different category/i })
    await expect(breadcrumbLink).toBeVisible()
    await expect(escapeHatchLink).toBeVisible()

    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)

    for (const link of [breadcrumbLink, escapeHatchLink]) {
      const color = await link.evaluate((el) => getComputedStyle(el).color)
      expect(contrastRatio(color, bodyBg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_MINIMUM)
    }
  })
})
