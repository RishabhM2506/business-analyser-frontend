# Contributing

This is a private repo (`RishabhM2506/business-analyser-frontend`). These notes exist mainly so
future-me (or anyone I add as a collaborator) doesn't have to reverse-engineer the workflow.

## Commit messages — Conventional Commits

Every commit message must follow [Conventional
Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

Common `type`s: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `build`,
`perf`. Example: `feat(router): add named routes for HS category/item picker`.

This is enforced by `commitlint` (`commitlint.config.js`, extending
`@commitlint/config-conventional`) via a husky `commit-msg` hook — a non-conforming commit message
is rejected locally, before it ever reaches CI.

## Pre-commit hooks

`husky` + `lint-staged` run on every commit (`.husky/pre-commit`):

- ESLint (`--fix`) on staged `.ts`/`.vue`/`.js` files
- Prettier (`--write`) on staged `.ts`/`.vue`/`.js`/`.json`/`.css`/`.md`/`.yml` files

This is the **fast subset** of what CI runs — it catches most problems before push, but CI is
still the source of truth (it also runs type-checking, tests, and the full unlint-staged lint
pass, none of which are cheap enough for every commit).

Hooks install automatically on `npm install` via the `prepare` script. If they're ever not
running, check that `npm run prepare` (`husky`) has been run and that `.husky/pre-commit` /
`.husky/commit-msg` are executable.

## Branch / PR workflow

1. Branch off `main`: `git checkout -b feat/short-description`.
2. Commit in logical, Conventional-Commits-formatted units.
3. Open a PR against `main`. CI (`.github/workflows/ci.yml`) must go green: `lint`, `typecheck`,
   `unit`, `e2e`, `prod-audit`, `build`, `secret-scan`.
4. Once branch protection is enabled on `main`, at least one passing review + all checks green is
   required before merge — no force-push to `main`, no bypassing checks.

## Before opening a PR, locally

```sh
npm run lint
npm run type-check
npm run test:unit
npm run test:e2e
npm run build
```

All five should pass. This is exactly what CI checks, run locally, so surprises in CI are rare.

## Code conventions

See [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) — directory layout, state management, API client
patterns, security posture (in particular: never `v-html` on model or upstream content), and what
this repo deliberately does differently from its reference repo.
