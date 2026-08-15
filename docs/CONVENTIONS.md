# CONVENTIONS.md

Reference repo: `food-delivery-frontend` (sibling to this project, not part of this repo).
`docs/PHASE0-FINDINGS.md` / `CONVENTIONS-DRAFT.md` in `BusinessAnalysingAgent/docs/` was the Phase 0
research pass over that repo. This file is the Phase 2 rewrite, validated against the code that
actually exists in _this_ repo — not a restatement of the draft. Where the draft's plan and the
built repo diverge, the built repo wins; that divergence is called out below.

The reference repo's own lesson, stated in the Phase 0 draft, is worth repeating here: its
`Clauderules.md` prescribed Vite + TS + composables, but the shipped code was Vue CLI + JS with
none of that. **A conventions doc that drifts from the code is worse than no doc.** Treat this file
as accurate as of the last time it was edited alongside a real code change, not as an aspiration.

## 1. Directory / component layout

`src/` is flat and resource-oriented, matching the reference repo's approach and
`docs/PLAN.md` §4.2 exactly: `components/`, `views/`, `router/`, `stores/`, `services/`,
`constants/`, `composables/`, `types/`, `styles/`.

- `components/` is sub-divided by feature domain (`hs-picker/`, `analysis/`) plus `common/` for
  generic UI atoms (buttons, loading/error/empty states) — same pattern as the reference repo's
  `auth/`, `onboarding/`, `common/` split.
- `views/` = one file per route, suffixed `View` (`LandingView.vue`, `HsCategoryView.vue`, ...) —
  carried over directly.
- 100% `<script setup lang="ts">`, zero Options API. SFC block order: `<template>` →
  `<script setup>` → `<style scoped>` — carried over directly.

## 2. State management — Pinia

One store so far (`stores/thread.ts`), Setup Store syntax (`defineStore('thread', () => {...})`),
internally grouped by `// --- state ---` / `// --- actions ---` comments — same shape as the
reference repo's two stores.

**Deliberate departure**: the reference repo's `services/api.js` avoids importing the store
directly via a `configureApi()` callback-registry hook (real circular-import risk there, since
its interceptors call back into the auth store for token refresh). This app's `services/api.ts`
has no such need — v1 has no auth/session concept at all (master brief §1.2), so there's nothing
for the API layer to call back into the store for. The hook-registry indirection would be an
unused abstraction with no current caller — dropped, not carried over. If a future feature needs
the store to configure the API layer (e.g. an auth token once real auth exists), reintroduce the
same pattern then, not preemptively.

## 3. Routing

`createWebHistory` + **named routes only**, centralized in `constants/routes.ts`
(`ROUTE_NAMES`, `ROUTE_PATHS`) — components and views navigate via `{ name: ROUTE_NAMES.X }`,
never a raw path string. Every route is lazy-loaded (`component: () => import(...)`). This is a
direct, deliberate port of the reference repo's best pattern (Phase 0 draft §3), including the
`Record<RouteName, string>` typed path map.

**Deliberate departure**: the reference repo's `router.beforeEach` guard exists entirely for
auth/onboarding gating (`guestOnly`, `requiresAuth` meta flags). v1 has no auth, so there is no
guard yet — adding an empty one would be exactly the kind of untested, callerless abstraction
`PROMPT.md` §3's anti-goal warns against. `router/index.ts` is a plain route table today; a guard
gets added the day there's something to guard.

## 4. Composables

**Deliberate departure, matching what the Phase 0 draft already recommended**: the reference repo
documented a `composables/` layer but never built one (all reusable logic was plain functions in
`utils/*.js`). This repo builds it for real, day one: `useHsTaxonomy`, `useThread`,
`useStreamingResponse` in `src/composables/`, each with a fully-typed exported signature. Their
bodies are intentionally stubbed (`throw new Error('not implemented')`) — Phase 2 is data
contracts and structure, not the HS search index or the real thread API calls. Each stub carries a
`// TODO(Phase 3): ...` comment naming exactly what it wires up to.

## 5. API client layer

Single Axios instance + one `apiRequest()` wrapper in `services/api.ts`, matching the reference
repo's "one client, all resource calls funnel through it" rule.

Ported directly:

- **Request ID header.** Every outgoing request gets a client-generated `X-Request-ID`
  (`crypto.randomUUID()`), for trace correlation — same intent as the reference repo's
  `X-Device-ID` header, adapted to this project's actual need (request tracing, not device
  identity — v1 has no device/session concept).
- **Normalized `ApiError` class.** Every rejected call throws one `ApiError`, never a raw
  `AxiosError` — same shape of guarantee as the reference repo's `ApiError`, with getters adapted
  to this backend's actual error vocabulary (`isNetworkError`, `isTimeout`, `isBudgetExceeded`,
  `isRateLimited` — matching the `error_code` values named in `docs/PLAN.md` §3.2, e.g.
  `UPSTREAM_TIMEOUT`, `BUDGET_EXCEEDED`) rather than the reference repo's session/auth-specific
  getters (`isSessionExpired`), which don't apply — v1 has no sessions.
- **"The envelope decides success, not the raw HTTP status."** This is the reference repo's
  single best idea in this layer (Phase 0 draft §5) and is ported in spirit, adapted to the real
  schema: this backend's contract (`docs/PLAN.md` §3.2) is Pydantic response models, not the
  reference's generic `{status: "success"|"error", data}` wrapper. The response interceptor
  treats **the presence of an `error_code` field in the response body** as the failure signal,
  independent of the HTTP status code it arrived with — the same protection against "a 200 that
  is secretly an error," expressed against the schema this project actually has instead of one it
  doesn't.
- All endpoint paths centralized in `constants/apis.ts` (`API_URLS`), referenced by name, with a
  `buildPath()` helper for `:param` substitution — carried over directly.

**Deliberate departure**: the reference repo's retry logic was narrow by design (one
guest-token-refresh-and-replay path) and its own Phase 0 note flagged this as a gap for a
chat/LLM backend, which needs real retry-with-backoff. That real retry policy is **not** built in
Phase 2 — it's genuine business/reliability logic (what's retryable, how many attempts, backoff
shape) that belongs with the real `useThread` implementation in Phase 3, not invented ahead of the
endpoints it would retry against. `ApiError.retryable` (mirrors the backend's own `retryable`
field) and `ApiError.isTimeout`/`isRateLimited` are already in place as the signals a future retry
policy would key off.

**No token storage tiering carried over.** The reference repo's tiered `localStorage` /
`sessionStorage` / HttpOnly-cookie split (Phase 0 draft §11) is entirely about auth token
lifetime — v1 has no auth (master brief §1.2), so there is nothing to store. Revisit this
specific pattern the day real auth ships, not before.

## 6. Environment / config

- `import.meta.env.VITE_*`, typed explicitly in `src/vite-env.d.ts` (the reference repo used
  webpack's `process.env.VUE_APP_*`; this is the direct Vite equivalent named in the Phase 0
  draft).
- `.env.example` documents every variable with an inline comment; `.env` is gitignored.
- Dev proxy pattern (`vite.config.ts` → `server.proxy['/api']`) ported directly from the
  reference repo's webpack devServer proxy — same reasoning: same-origin requests in dev, no CORS
  configuration needed just to develop locally.

## 7. Build tooling & aliases

`@/* → src/*` alias, defined in both `vite.config.ts` (`resolve.alias`) and every `tsconfig*.json`
that needs it (`tsconfig.app.json`'s `compilerOptions.paths`) — the reference repo couldn't
establish this itself (it's webpack, not Vite), but its Phase 0 draft correctly called out this
as the thing to port once on Vite. Done.

## 8. Lint / format / types

This is where this repo establishes its own bar from scratch rather than inheriting anything —
the reference repo's tier here (legacy `.eslintrc`-in-`package.json`, `vue3-essential`, no
Prettier, no TypeScript) was explicitly named in Phase 0 as the weakest part of that repo:

- **ESLint flat config** (`eslint.config.js`), built on `@vue/eslint-config-typescript`'s
  `withVueTs()` helper: `eslint-plugin-vue`'s `flat/recommended` (the top tier the plugin ships —
  v9+ dropped the old separate "strict" preset name; `recommended` _is_ the strict tier now,
  a superset of `essential` + `strongly-recommended`), `typescript-eslint`'s `strict` preset
  (a superset of `recommended`, non-type-checked — see note below), and
  `eslint-plugin-vuejs-accessibility`'s `flat/recommended` for template a11y linting.
- **Prettier + `eslint-config-prettier`**, applied last in the flat config array so its
  stylistic-rule-disabling always wins — new in this repo, absent from the reference.
- **`vue-tsc --build`** (`npm run type-check`) as a real, separate CI job — new in this repo,
  which had zero TypeScript at all.
- **TypeScript `strict: true`**, plus `noUncheckedIndexedAccess` and `noImplicitOverride` on top
  of the baseline strict flag.

**Note on type-checked linting**: `typescript-eslint` offers a `strictTypeChecked` tier that uses
real type information (catches more, e.g. floating promises) but requires wiring
`parserOptions.project`/`projectService` across every linted file including `.vue` SFCs, and is
materially slower. This repo uses the non-type-checked `strict` tier for ESLint and leans on
`vue-tsc --build` as its own, separate, full-fidelity type-check job — cheaper to keep both fast
and correct than merging them into one slower, more fragile pass. Revisit if a bug class that only
type-aware linting would have caught actually ships.

**Note on dependency majors**: `vue-router` is deliberately pinned to the latest **4.x** release,
not the newer 5.x major available on npm. 5.x's peer dependencies pull in `@pinia/colada` and a
`vite` peer constraint unrelated to routing itself — that coupling isn't worth taking on for a
scaffold whose routing needs (named routes, lazy-loaded, no data-fetching layer) are fully served
by the well-established 4.x API. `typescript` is pinned to `~6.0.3` (not the newer 7.x on npm)
because `typescript-eslint`'s current major hasn't raised its peer ceiling past `<6.1.0` yet —
this is a hard compatibility constraint, not a preference.

## 9. Commit hooks

**New in this repo** (reference had none — lint problems were only ever caught in CI):
`husky` + `lint-staged` on `pre-commit` (ESLint `--fix` + Prettier `--write` on staged files —
the fast subset, matching `PROMPT.md` §5 Phase 2's requirement), and `commitlint` +
`@commitlint/config-conventional` on `commit-msg`, enforcing Conventional Commits before a commit
message ever reaches a PR. See `CONTRIBUTING.md`.

## 10. CI

`.github/workflows/ci.yml` mirrors the reference repo's parallel fan-out shape (independent jobs,
each doing its own `npm ci`, `docs/PLAN.md` §8.2 confirmed this as worth keeping despite the minor
cache-reuse inefficiency it costs) and its good practice of **pinning actions to full commit SHAs
with a version comment** — carried over directly, every SHA in this repo's workflow was resolved
from the GitHub API at write time, not guessed.

New relative to the reference repo's 4-way fan-out (`lint`, `unit-tests`, `production-audit`,
`build`): a `typecheck` job (`vue-tsc --build`), an `e2e` job (Playwright, against a real built +
served app), and a `secret-scan` job (gitleaks) — none of which the reference repo had. No
`deploy` job yet (the reference repo's Vercel deploy step is specific to that project's hosting
choice, not yet decided here).

## 11. Security posture

- **Zero `v-html` in this repo, and it stays that way for model/upstream content.** The reference
  repo had zero `v-html` usage too, but only because nothing in it ever rendered
  externally-sourced or LLM-generated text — it never had to make the choice. This project will:
  `AnalysisSummary.vue` renders the LLM-written analytical summary, and `TradeTable.vue` renders
  upstream Comtrade-derived numbers. **The rule, stated explicitly**: neither component, nor
  anything downstream of them, may use `v-html` on that data. Render it as text
  (`{{ }}` interpolation / structured props), never as injected HTML, never via a
  markdown-to-HTML pipeline. If a real future need for rich text formatting appears, the answer is
  a strict allowlist sanitiser (e.g. DOMPurify) reviewed as its own change — not a default
  `v-html`. This is master brief §8's requirement, made concrete for the two components where it
  will actually matter.
- **CSP.** New in this repo — the reference repo had none. `index.html` ships a
  `Content-Security-Policy` meta tag: `script-src 'self'` (no `unsafe-inline`, no `unsafe-eval`),
  `style-src 'self' 'unsafe-inline'` (a scoped exception for Vue's `:style` bindings, which render
  as inline `style="..."` attributes — CSS cannot execute script, so this is low-risk relative to
  loosening `script-src`), `connect-src 'self'` (will need the backend's real deployed origin
  added once known — noted inline in `index.html`). A `<meta>`-based CSP cannot set
  `frame-ancestors` or `report-uri`/`report-to` (the spec ignores those outside a real header) —
  a header-based CSP at whatever serves this in production is still worth adding later for full
  coverage; the meta tag is a client-side floor, not a substitute.
- **Secrets.** Never committed; `.env.example` documents every variable with no real values;
  secret scanning (gitleaks) runs in CI on every push/PR — new in this repo.
- **No auth/session storage tiering** — see §5. Nothing to store yet.

## 12. Testing

**New in this repo, direct fix of the reference repo's biggest gap**: the reference repo had
`@vue/test-utils` installed and never used (zero component tests across 11 components and 5
views), and zero e2e despite a stale code comment referencing "e2e testing." This repo:

- Uses **Vitest** (not Jest, since this is Vite-native — same reasoning the Phase 0 draft already
  landed on) + `@vue/test-utils`, with a real component test from the first commit
  (`tests/unit/AppButton.spec.ts`) proving the harness actually renders, mounts, and asserts on a
  component — not just installed and dormant.
- Uses **Playwright** for e2e (`tests/e2e/landing.spec.ts`), configured to build the app and serve
  it via `vite preview` rather than the dev server, so the suite exercises the same artifact a
  real deploy would ship (CSP included) — not the dev server's more permissive behavior.

## 13. Package manager / Node version

`npm` (`package-lock.json`), `.nvmrc` **and** `engines.node` in `package.json` both set — new
relative to the reference repo, which pinned Node only in CI (`setup-node@18`), not in-repo. The
floor (`>=22.22.1`) is the strictest constraint among this repo's own tooling (`lint-staged`
requires it), not an arbitrary choice.

## 14. Anti-patterns avoided (learned from the reference repo, not repeated)

- A conventions/rules doc that describes patterns the code doesn't implement. This file is
  updated in the same change as any structural decision it documents, or not updated at all.
- Untested abstractions with exactly one caller (`PROMPT.md` §3's explicit anti-goal) — see §2's
  and §3's "deliberately not carried over" notes above for the two concrete cases (the
  `configureApi()` hook registry, the auth route guard) where the reference repo's pattern was
  right for _its_ problem and is simply inapplicable to this one right now.
- No commit hooks, no Prettier, a permissive lint tier, no CSP, thin/one-sided test coverage,
  narrow retry logic presented as if it were general-purpose — all named explicitly above, all
  deliberately not repeated.
