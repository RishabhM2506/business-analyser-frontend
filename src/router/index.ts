import { nextTick, ref } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

import { ROUTE_NAMES, ROUTE_PATHS } from '@/constants/routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: ROUTE_PATHS[ROUTE_NAMES.LANDING],
      name: ROUTE_NAMES.LANDING,
      component: () => import('@/views/LandingView.vue'),
    },
    {
      path: ROUTE_PATHS[ROUTE_NAMES.HS_CATEGORY],
      name: ROUTE_NAMES.HS_CATEGORY,
      component: () => import('@/views/HsCategoryView.vue'),
    },
    {
      path: ROUTE_PATHS[ROUTE_NAMES.HS_ITEM],
      name: ROUTE_NAMES.HS_ITEM,
      component: () => import('@/views/HsItemView.vue'),
      props: true,
    },
    {
      path: ROUTE_PATHS[ROUTE_NAMES.ANALYSIS],
      name: ROUTE_NAMES.ANALYSIS,
      component: () => import('@/views/AnalysisView.vue'),
      props: true,
    },
    { path: '/:pathMatch(.*)*', redirect: { name: ROUTE_NAMES.LANDING } },
  ],
})

/**
 * Human-readable title per route, for the `aria-live` announcement below.
 * Deliberately a plain lookup (not `document.title`, which nothing in this
 * app sets yet — out of scope here) — just enough for a screen-reader user
 * to know *something* changed and roughly what to. Not required to track
 * a view's actual rendered `<h1>` text exactly (e.g. AnalysisView's is
 * dynamic and not present at all during its loading state) — the focus
 * move below is the stronger signal when a heading is already there; this
 * is the guaranteed-to-fire fallback for when it isn't yet.
 */
const ROUTE_TITLES: Partial<Record<string, string>> = {
  [ROUTE_NAMES.LANDING]: 'Business Analyser',
  [ROUTE_NAMES.HS_CATEGORY]: 'Choose a category',
  [ROUTE_NAMES.HS_ITEM]: 'Choose an item',
  [ROUTE_NAMES.ANALYSIS]: 'Trade analysis',
}

/**
 * Phase 4 finding M17/Frontend-QA#5: SPA route transitions performed zero
 * focus management — live-traced keyboard focus landed on `<body>` (nothing)
 * immediately after a navigation, with no `aria-live` announcement either, on
 * every single route change in the app. Read by a persistent
 * `aria-live="polite"` region in App.vue.
 */
export const routeAnnouncement = ref('')

/**
 * Phase 4 finding M18/Frontend-QA#6: a fast real double-click on a category
 * search result can select an unintended item on the next screen — the
 * second click (~40ms later) lands on whatever rendered at that same
 * *screen coordinate* after the first click's navigation, which happens to
 * be the new item list's first row.
 *
 * Time is the real discriminator here, not position — measured directly:
 * `HsCategoryView`/`HsItemView` share close enough padding/heading structure
 * that the clicked category row and the new item list's first row can land
 * within a few px of each other (measured 3px apart at a 375px viewport),
 * so a genuine two-step category-then-item pick is *not* reliably
 * distinguishable from a double-click's accidental echo by position alone in
 * this app's actual layout — a tight position radius mostly just adds
 * defense-in-depth for the general case, it isn't what makes this work.
 * `NAVIGATION_LOCKOUT_MS` is tuned to bracket real double-click speed
 * (common OS defaults run 300-500ms; the source report measured ~40ms for
 * its own reproduction) while staying short enough that it's very unlikely
 * to swallow a deliberately fast *human* second choice, which requires
 * perceiving the new screen and choosing a row on it — meaningfully slower
 * than a double-click's second click, which requires no new perception at
 * all. (Scripted e2e tests that click a category then an item with zero
 * delay are not a realistic stand-in for that human sequence and add an
 * explicit small wait between the two — see full-flow.spec.ts/
 * responsive.spec.ts/focus-management.spec.ts.)
 */
const NAVIGATION_LOCKOUT_MS = 400
const NAVIGATION_LOCKOUT_RADIUS_PX = 40
let navigationLock: { x: number; y: number; expiresAt: number } | null = null

export function isNavigationBlocked(x: number, y: number): boolean {
  if (!navigationLock || Date.now() > navigationLock.expiresAt) {
    return false
  }
  const dx = x - navigationLock.x
  const dy = y - navigationLock.y
  return Math.hypot(dx, dy) <= NAVIGATION_LOCKOUT_RADIUS_PX
}

export function markNavigating(x: number, y: number): void {
  navigationLock = { x, y, expiresAt: Date.now() + NAVIGATION_LOCKOUT_MS }
}

router.afterEach((to) => {
  const title = (typeof to.name === 'string' ? ROUTE_TITLES[to.name] : undefined) ?? 'page'
  routeAnnouncement.value = `Navigated to ${title}.`

  // Move focus to the new view's <h1> so keyboard/screen-reader users get a
  // real signal a navigation happened, instead of focus staying wherever it
  // was (or dropping to <body> — confirmed live in the source report). Each
  // view's <h1> carries tabindex="-1" specifically so it's a valid focus
  // target despite not being natively focusable. Waits a tick since the new
  // route's component may not have finished rendering into the DOM yet at
  // the point afterEach fires (e.g. an async route component resolving) —
  // not every view has an <h1> in the DOM at every instant (AnalysisView
  // while still loading, for one), which is exactly why the aria-live
  // announcement above exists as a fallback that doesn't depend on one.
  void nextTick(() => {
    document.querySelector<HTMLElement>('main h1')?.focus()
  })
})

export default router
