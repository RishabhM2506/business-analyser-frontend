# business-analyser-frontend

Vue 3 + TypeScript + Vite frontend for the **Business Analyser**: a user picks an HS
(Harmonized System) trade-code category, then a specific item, and gets back a grounded 5-year
import/export table for that item's top trading partners, with an LLM-written description and
summary — never LLM-written numbers.

This repo is currently a **scaffold**: real tooling and project structure, no business logic yet.
See [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) for what conventions this repo follows and why.

Architecture, data contracts, and the full v1 plan live in the sibling
[`BusinessAnalysingAgent/docs/PLAN.md`](../BusinessAnalysingAgent/docs/PLAN.md) (not part of this
repo — see that repo's root for the master brief and planning docs). The backend counterpart is
[`business-analyser-agentic-workflow`](https://github.com/RishabhM2506/business-analyser-agentic-workflow).

## Stack

- [Vue 3](https://vuejs.org/) (Composition API, `<script setup>` only) + [TypeScript](https://www.typescriptlang.org/) (strict) + [Vite](https://vite.dev/)
- [Pinia](https://pinia.vuejs.org/) for state, [Vue Router](https://router.vuejs.org/) (named routes only)
- [ESLint](https://eslint.org/) flat config + [Prettier](https://prettier.io/) + [vue-tsc](https://github.com/vuejs/language-tools) type checking + [eslint-plugin-vuejs-accessibility](https://vue-a11y.github.io/eslint-plugin-vuejs-accessibility/)
- [Vitest](https://vitest.dev/) + [@vue/test-utils](https://test-utils.vuejs.org/) for component tests, [Playwright](https://playwright.dev/) for e2e
- [husky](https://typicode.github.io/husky/) + [lint-staged](https://github.com/lint-staged/lint-staged) pre-commit, [commitlint](https://commitlint.js.org/) enforcing [Conventional Commits](https://www.conventionalcommits.org/)

## Getting started

Requires Node `>=22.22.1` (see `.nvmrc`).

```sh
npm ci
cp .env.example .env   # defaults are fine for local dev
npm run dev
```

The dev server proxies same-origin `/api/*` requests to `http://localhost:8000` (see
`vite.config.ts`) — start the backend separately (its own README) to exercise real API calls once
it exposes endpoints. Until then, `src/services/api.ts` has no live endpoint to call successfully
— that's expected at this stage.

## Available scripts

| Script                    | What it does                                                          |
| ------------------------- | --------------------------------------------------------------------- |
| `npm run dev`             | Start the Vite dev server                                             |
| `npm run build`           | Production build (`dist/`)                                            |
| `npm run preview`         | Serve the production build locally                                    |
| `npm run type-check`      | `vue-tsc --build` — real type checking, not just transpilation        |
| `npm run lint`            | ESLint over the whole repo                                            |
| `npm run lint:fix`        | ESLint with autofix                                                   |
| `npm run format`          | Prettier, writes                                                      |
| `npm run format:check`    | Prettier, check-only (what CI runs)                                   |
| `npm run test:unit`       | Vitest, single run                                                    |
| `npm run test:unit:watch` | Vitest, watch mode                                                    |
| `npm run test:e2e`        | Playwright — builds the app, serves it, runs the e2e suite against it |

## Testing

- **Unit/component**: `npm run test:unit` (Vitest + `@vue/test-utils`). See `tests/unit/`.
- **E2E**: `npm run test:e2e` (Playwright). First run: `npx playwright install --with-deps
chromium`. See `tests/e2e/` — the smoke test loads the landing page and clicks through to the
  category picker.

## CI

`.github/workflows/ci.yml` runs seven independent jobs on every PR and push to `main`: `lint`
(ESLint + Prettier check), `typecheck` (`vue-tsc --build`), `unit` (Vitest), `e2e` (Playwright),
`prod-audit` (`npm audit --omit=dev --audit-level=high`), `build` (`vite build`), and
`secret-scan` (gitleaks). All must pass before merge once branch protection is enabled.

## Security notes

- **No `v-html` on model or upstream content, ever.** See `docs/CONVENTIONS.md` for the full rule
  and reasoning — this is the project's one hard security line for rendering.
- `index.html` ships a restrictive `Content-Security-Policy` meta tag (no `unsafe-inline` for
  scripts). It will need `connect-src` extended once the backend's real deployed origin is known
  — see the comment above the tag in `index.html`.
- Secrets are never committed. `.env` is gitignored; `.env.example` documents every variable.
  CI runs a gitleaks secret scan on every push/PR.

## HS taxonomy data

`public/hs-taxonomy.json` (6,939 entries, ~1.2 MB) is built from the same public-domain source the
backend uses — [`datasets/harmonized-system`](https://github.com/datasets/harmonized-system)
(ODC-PDDL, `docs/PLAN.md` Gate 0 finding) — converted from CSV to JSON with the columns renamed to
this project's `snake_case` convention (`hs_code`, `description`, `level`, `section`, `parent`).
It's real data, checked in as-is; **indexing and searching it (MiniSearch, virtualised list) is
Phase 3 work** — see the `// TODO(Phase 3)` in `src/composables/useHsTaxonomy.ts`.
