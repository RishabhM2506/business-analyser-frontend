import { defineStore } from 'pinia'
import { ref } from 'vue'

import { useThread } from '@/composables/useThread'
import { ApiError } from '@/services/api'
import type { TradeAnalysisResponse, TradeQuery } from '@/types/generated'

/** Normalizes an unknown `catch` value (TS types it `unknown`) into the store's error state. */
function toApiError(caught: unknown): ApiError {
  if (caught instanceof ApiError) {
    return caught
  }
  const message =
    caught instanceof Error ? caught.message : 'Something went wrong. Please try again.'
  return new ApiError({
    httpStatus: null,
    errorCode: 'UNKNOWN_ERROR',
    message,
    retryable: true,
    traceId: null,
  })
}

/**
 * Setup-store holding one analysis thread's client-side state. The thread's
 * durable state lives server-side (LangGraph checkpointer, docs/PLAN.md §2.2)
 * — this store mirrors it for rendering, it does not own it.
 */
export const useThreadStore = defineStore('thread', () => {
  // --- state ---
  const threadId = ref<string | null>(null)
  const messages = ref<TradeAnalysisResponse[]>([])
  const loading = ref(false)
  const error = ref<ApiError | null>(null)

  // One composable instance for this store's whole lifetime, so the
  // internal threadId it tracks (needed by sendMessage, which takes no
  // threadId argument — see useThread.ts) stays in sync across actions.
  const thread = useThread()

  // Discards a stale in-flight response if a newer submitQuery() has since
  // started (e.g. rapid navigation between HS items) — prevents an older
  // response from clobbering a newer one, or loading flipping false early.
  let requestSeq = 0

  // --- actions ---
  function reset(): void {
    requestSeq += 1
    threadId.value = null
    messages.value = []
    loading.value = false
    error.value = null
  }

  /** POST /threads (docs/PLAN.md §3.3) — call once, on "Start my process." */
  async function startThread(): Promise<void> {
    reset()
    const seq = requestSeq
    loading.value = true
    try {
      const id = await thread.createThread()
      if (seq !== requestSeq) return
      threadId.value = id
    } catch (caught) {
      if (seq !== requestSeq) return
      error.value = toApiError(caught)
    } finally {
      if (seq === requestSeq) loading.value = false
    }
  }

  /**
   * POST /threads/{id}/messages — call on HS item selection. Defensively
   * creates a thread first if one doesn't exist yet (e.g. the user
   * deep-linked or refreshed straight into AnalysisView, bypassing
   * LandingView's "Start my process") rather than failing outright — v1
   * doesn't implement GET /threads/{id} resume (out of scope, docs/PLAN.md
   * §3.3 names it for a later phase), so a fresh thread is the correct
   * fallback rather than a dead end.
   */
  async function submitQuery(query: TradeQuery): Promise<void> {
    const seq = ++requestSeq
    loading.value = true
    error.value = null
    try {
      if (!threadId.value) {
        const id = await thread.createThread()
        if (seq !== requestSeq) return
        threadId.value = id
      }
      const response = await thread.sendMessage(query)
      if (seq !== requestSeq) return
      messages.value.push(response)
    } catch (caught) {
      if (seq !== requestSeq) return
      error.value = toApiError(caught)
    } finally {
      if (seq === requestSeq) loading.value = false
    }
  }

  return { threadId, messages, loading, error, reset, startThread, submitQuery }
})
