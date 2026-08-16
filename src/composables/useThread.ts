import { ref, type Ref } from 'vue'

import { apiRequest } from '@/services/api'
import { API_URLS } from '@/constants/apis'
import type {
  CreateThreadResponse,
  ResponseEnvelope,
  TradeAnalysisResponse,
  TradeQuery,
} from '@/types/generated'

import { useStreamingResponse } from './useStreamingResponse'

export interface UseThreadReturn {
  threadId: Ref<string | null>
  isLoading: Ref<boolean>
  /** POST /threads (docs/PLAN.md §3.3) — creates the thread, returns its id. */
  createThread: () => Promise<string>
  /** POST /threads/{id}/messages — invokes the graph on the given selection. */
  sendMessage: (query: TradeQuery) => Promise<TradeAnalysisResponse>
}

/**
 * Thin wrapper around the two thread endpoints. Not a cross-component
 * singleton itself — `stores/thread.ts` instantiates exactly one of these
 * (Pinia stores are already app-wide singletons), so `threadId` set by
 * `createThread()` is naturally available to a later `sendMessage()` call on
 * the same instance, matching this composable's fixed signature (no
 * threadId param on `sendMessage` — see docs/PLAN.md §4.2).
 */
export function useThread(): UseThreadReturn {
  const threadId = ref<string | null>(null)
  const isLoading = ref(false)
  const streaming = useStreamingResponse()

  async function createThread(): Promise<string> {
    isLoading.value = true
    try {
      const response = await apiRequest<CreateThreadResponse>(API_URLS.CREATE_THREAD, {
        method: 'POST',
      })
      threadId.value = response.thread_id
      return response.thread_id
    } finally {
      isLoading.value = false
    }
  }

  async function sendMessage(query: TradeQuery): Promise<TradeAnalysisResponse> {
    const currentThreadId = threadId.value
    if (!currentThreadId) {
      throw new Error(
        'useThread.sendMessage: no thread exists yet — call createThread() first (docs/PLAN.md §3.3: POST /threads before POST /threads/{id}/messages).',
      )
    }

    isLoading.value = true
    streaming.reset()
    try {
      const envelope = await apiRequest<ResponseEnvelope, TradeQuery>(API_URLS.POST_MESSAGE, {
        method: 'POST',
        params: { threadId: currentThreadId },
        body: query,
      })
      streaming.handleChunk(envelope)
      if (!streaming.result.value) {
        // v1's backend only ever sends `type: "final"` — reaching here means
        // either a `"delta"` chunk (backend doesn't send these yet) or a
        // shape this composable doesn't recognize. Surfacing a clear error
        // beats silently resolving with no data.
        throw new Error(
          'useThread.sendMessage: response envelope did not resolve to a final result.',
        )
      }
      return streaming.result.value
    } finally {
      isLoading.value = false
    }
  }

  return { threadId, isLoading, createThread, sendMessage }
}
