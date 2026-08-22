// Backend endpoint paths (docs/PLAN.md §3.3), centralized and referenced by
// name — services never inline a path string. `:param` segments are filled in
// by `buildPath()` in `services/api.ts`.

export const API_URLS = {
  /** POST — creates a thread (on "Start my process"). Returns `CreateThreadResponse`. */
  CREATE_THREAD: '/threads',
  /** GET — thread state/history, for resume-after-refresh. */
  GET_THREAD: '/threads/:threadId',
  /** POST — body is `TradeQuery`-shaped. Invokes the graph on this thread. */
  POST_MESSAGE: '/threads/:threadId/messages',
  /**
   * POST — body is `ProductSearchQuery`-shaped. Free-text product search
   * (2026-08-20 roadmap decision). Bare response, not envelope-wrapped —
   * see `types/generated.ts`'s `ProductSearchResponse` doc comment.
   */
  POST_SEARCH: '/threads/:threadId/search',
  /** GET — verifies DB + checkpointer reachability, not an unconditional 200. */
  HEALTHZ: '/healthz',
} as const

export type ApiUrlKey = keyof typeof API_URLS
