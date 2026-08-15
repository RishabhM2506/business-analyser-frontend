import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { ApiError } from '@/services/api'
import type { TradeAnalysisResponse, TradeQuery } from '@/types/generated'

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

  // --- actions ---
  function reset(): void {
    threadId.value = null
    messages.value = []
    loading.value = false
    error.value = null
  }

  // TODO(Phase 3): call useThread().createThread(), populate threadId, set loading/error.
  async function startThread(): Promise<void> {
    throw new Error('not implemented')
  }

  // TODO(Phase 3): call useThread().sendMessage(query), push the result into messages.
  async function submitQuery(_query: TradeQuery): Promise<void> {
    throw new Error('not implemented')
  }

  return { threadId, messages, loading, error, reset, startThread, submitQuery }
})
