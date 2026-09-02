import { defineStore } from 'pinia'
import { ref } from 'vue'

import { useTradeReport } from '@/composables/useTradeReport'
import { ApiError } from '@/services/api'
import { useThreadStore } from '@/stores/thread'
import type { TradeReportQuery, TradeReportResponse } from '@/types/generated'

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
 * Setup-store for the India trade-report pipeline (2026-08-25 addition).
 * Kept separate from `stores/thread.ts` (owns `/messages`) and
 * `stores/search.ts`, mirroring `stores/search.ts`'s own shape exactly —
 * depends on `useThreadStore().threadId`, creating one via `startThread()`
 * if absent, the same defensive pattern every other store here already uses.
 */
export const useTradeReportStore = defineStore('tradeReport', () => {
  // --- state ---
  const result = ref<TradeReportResponse | null>(null)
  const loading = ref(false)
  const error = ref<ApiError | null>(null)

  const tradeReport = useTradeReport()

  // Discards a stale in-flight response if a newer fetchReport() has since
  // started — mirrors `stores/thread.ts`/`stores/search.ts`'s identical
  // `requestSeq` guard.
  let requestSeq = 0

  // --- actions ---
  function reset(): void {
    requestSeq += 1
    result.value = null
    loading.value = false
    error.value = null
  }

  /** POST /threads/{id}/trade-report. */
  async function fetchReport(query: TradeReportQuery): Promise<void> {
    const seq = ++requestSeq
    result.value = null
    loading.value = true
    error.value = null
    try {
      const threadStore = useThreadStore()
      if (!threadStore.threadId) {
        await threadStore.startThread()
        if (seq !== requestSeq) return
        if (threadStore.error) {
          error.value = threadStore.error
          return
        }
      }
      const threadId = threadStore.threadId
      if (!threadId) {
        // Defensive: startThread() above either set threadId or set
        // threadStore.error (handled above) — should never both be unset.
        throw new Error(
          'useTradeReportStore.fetchReport: no thread id available after startThread().',
        )
      }

      const response = await tradeReport.fetchReport(threadId, query)
      if (seq !== requestSeq) return
      result.value = response
    } catch (caught) {
      if (seq !== requestSeq) return
      error.value = toApiError(caught)
    } finally {
      if (seq === requestSeq) loading.value = false
    }
  }

  return { result, loading, error, reset, fetchReport }
})
