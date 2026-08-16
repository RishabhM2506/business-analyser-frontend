import { fileURLToPath } from 'node:url'

import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'

import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'tests/e2e/**', 'tests/integration-e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      include: ['tests/unit/**/*.spec.ts'],
      // Finding M14 (Phase 4 review, ARCH-08): "unit tests with a coverage
      // floor" is an explicit master-brief §Phase 2 CI requirement that was
      // never wired up on either repo. Thresholds set a few points below
      // the measured figure at the time this was added — enough to fail
      // loudly on a large uncovered addition without being so tight it
      // breaks on every small, legitimately-hard-to-cover line (error
      // branches, etc).
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,vue}'],
        thresholds: {
          lines: 80,
          statements: 80,
          functions: 75,
          branches: 75,
        },
      },
    },
  }),
)
