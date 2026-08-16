import { defineConfig, devices } from '@playwright/test'

// Cross-repo integration config (FINDINGS.md M8 / ARCH-09) — deliberately
// separate from playwright.config.ts, which builds and serves this repo in
// isolation. This one points at an already-running `docker compose up`
// stack (the real backend, the real dockerized frontend, no mocks) and has
// no `webServer` block of its own: bringing that stack up/down is the
// caller's job (see the root `Makefile`'s `integration-check` target),
// because this config has no way to also start the *other* repo's service.
const BASE_URL = 'http://localhost:5173'

export default defineConfig({
  testDir: './tests/integration-e2e',
  fullyParallel: false, // shares one backend + one rate-limited live upstream
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 45_000,
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
