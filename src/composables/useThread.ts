import type { Ref } from 'vue'

import type { TradeAnalysisResponse, TradeQuery } from '@/types/generated'

export interface UseThreadReturn {
  threadId: Ref<string | null>
  isLoading: Ref<boolean>
  /** POST /threads (docs/PLAN.md §3.3) — creates the thread, returns its id. */
  createThread: () => Promise<string>
  /** POST /threads/{id}/messages — invokes the graph on the given selection. */
  sendMessage: (query: TradeQuery) => Promise<TradeAnalysisResponse>
}

// TODO(Phase 3): implement against services/api.ts (apiRequest + API_URLS.CREATE_THREAD / POST_MESSAGE).
export function useThread(): UseThreadReturn {
  throw new Error('not implemented')
}
