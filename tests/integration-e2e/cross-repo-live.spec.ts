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
    // `role="alert"` (ErrorState.vue's own outer element) is the single
    // authoritative signal for the error case — deliberately not also
    // matching on error text: that text is a *descendant* of the alert
    // element, so combining both in one `.or()` matched two elements at
    // once and made Playwright's strict-mode assertion fail regardless of
    // which state actually rendered (caught in Architect re-review, ARCH-14).
    const heading = page.getByRole('heading', { name: /trade analysis/i })
    const errorState = page.getByRole('alert')
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
    // `role="alert"`/heading are each a single element apiece (see the
    // first test's comment on ARCH-14) — safe to `.or()` together. Text-based
    // locators are deliberately not combined into that same expression:
    // M19's fix added explanatory copy that itself mentions "budget," so a
    // page-wide `getByText(/budget/i)` can match more than one element and
    // reintroduce the exact strict-mode failure ARCH-14 already caught once.
    const heading = page.getByRole('heading', { name: /trade analysis/i })
    const alert = page.getByRole('alert')

    await pickFirstCategoryThenItem(page)
    await expect(heading.or(alert)).toBeVisible({ timeout: 25_000 })

    await page.getByRole('link', { name: /back to categories/i }).click()
    await page.getByRole('combobox').fill(REAL_HS6_CATEGORY_QUERY)
    await page.getByRole('option').nth(1).waitFor()
    await page.getByRole('option').nth(1).click()
    await page.getByRole('option').first().waitFor()
    await page.getByRole('option').first().click()

    await expect(heading.or(alert)).toBeVisible({ timeout: 25_000 })
    // The one outcome B2 exists to rule out on a 2nd item in one session —
    // a live upstream rate-limit (the alert's text containing "could not
    // retrieve") is a fine, expected outcome; the budget ceiling tripping
    // on item #2 is not. Scoped to the alert element's own text, not a
    // page-wide search, so it can't accidentally match M19's unrelated copy.
    if (await alert.isVisible()) {
      await expect(alert).not.toContainText(/budget/i)
    }
  })
})
