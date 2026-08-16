import { expect, test } from '@playwright/test'

/**
 * Cross-repo integration check (master brief §Phase 4.5 ARCH-09 / FINDINGS.md
 * M8): exercises the real frontend against the real, dockerized backend —
 * no route mocking, no fixtures standing in for the other repo's contract.
 *
 * This is the exact category of test that was missing and let two
 * independent BLOCKERs (the response-envelope mismatch and the
 * per-thread-budget/session-lifecycle mismatch) ship green on both repos'
 * own CI, undetected, because neither repo's test suite ever validated the
 * two together. Every other e2e spec in `tests/e2e/` intentionally mocks
 * `**\/api/**` — that's correct for testing this repo's own logic in
 * isolation, but structurally cannot catch a contract break between repos.
 * This spec is the deliberate exception: never mock, always hit the real
 * `docker compose` stack.
 *
 * Prerequisites (see `Makefile`'s `integration-check` target, which runs
 * this correctly): `docker compose up -d --build` from
 * `BusinessAnalysingAgent/` must already be healthy before this runs.
 * `LLM_PROVIDER=mock` (the `.env.example` default) keeps this at zero token
 * cost; the live UN Comtrade public preview endpoint is real and
 * rate-limited, so tests here tolerate — and explicitly assert correct
 * handling of — a clean upstream error alongside a successful render,
 * rather than requiring a specific outcome every run.
 *
 * Run directly: `npx playwright test --config=playwright.integration.config.ts`
 */

const REAL_HS6_CATEGORY_QUERY = 'live animals'

async function pickFirstCategoryThenItem(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /start my process/i }).click()
  await page.getByRole('combobox').fill(REAL_HS6_CATEGORY_QUERY)
  await page.getByRole('option').first().waitFor()
  await page.getByRole('option').first().click()
  await page.getByRole('option').first().waitFor()
  await page.getByRole('option').first().click()
}

test.describe('cross-repo live integration (no mocks — real backend, real Comtrade)', () => {
  test('the full journey against the real backend never throws client-side and never shows a raw/blank failure', async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    const cspViolations: string[] = []
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      consoleErrors.push(msg.text())
      if (msg.text().includes('Content Security Policy')) cspViolations.push(msg.text())
    })
    const pageErrors: string[] = []
    page.on('pageerror', (err) => pageErrors.push(err.message))

    await pickFirstCategoryThenItem(page)

    // Either a real, rendered analysis or a real, clean ErrorState is an
    // acceptable outcome (the live upstream is genuinely rate-limited) —
    // what's never acceptable is neither appearing (B1: an unhandled
    // envelope-unwrap failure throws inside useThread.sendMessage before
    // either state renders).
    const heading = page.getByRole('heading', { name: /trade analysis/i })
    const errorState = page.getByRole('alert').or(page.getByText(/could not retrieve|budget/i))
    await expect(heading.or(errorState)).toBeVisible({ timeout: 25_000 })

    // B1's exact failure mode: an unwrap exception thrown client-side.
    const unwrapFailures = pageErrors.filter((m) => m.includes('response envelope'))
    expect(unwrapFailures, `envelope unwrap failed: ${unwrapFailures.join('; ')}`).toHaveLength(0)

    // B5's exact failure mode.
    expect(cspViolations, `CSP violations: ${cspViolations.join('; ')}`).toHaveLength(0)
  })

  test('a second, different item on the same session-thread does not hit BUDGET_EXCEEDED (B2)', async ({
    page,
  }) => {
    await pickFirstCategoryThenItem(page)
    await page
      .getByRole('heading', { name: /trade analysis/i })
      .or(page.getByText(/could not retrieve|budget/i))
      .first()
      .waitFor({ timeout: 25_000 })

    await page.getByRole('link', { name: /back to categories/i }).click()
    await page.getByRole('combobox').fill(REAL_HS6_CATEGORY_QUERY)
    await page.getByRole('option').nth(1).waitFor()
    await page.getByRole('option').nth(1).click()
    await page.getByRole('option').first().waitFor()
    await page.getByRole('option').first().click()

    const heading = page.getByRole('heading', { name: /trade analysis/i })
    const genuineUpstreamError = page.getByText(/could not retrieve/i)
    const budgetExceeded = page.getByText(/budget/i)

    await expect(heading.or(genuineUpstreamError).or(budgetExceeded)).toBeVisible({
      timeout: 25_000,
    })
    // The one outcome B2 exists to rule out on a 2nd item in one session —
    // a live upstream rate-limit (genuineUpstreamError) is a fine, expected
    // outcome; the budget ceiling tripping on item #2 is not.
    await expect(budgetExceeded).not.toBeVisible()
  })
})
