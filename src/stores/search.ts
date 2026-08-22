import { defineStore } from 'pinia'
import { ref } from 'vue'

import { useProductSearch } from '@/composables/useProductSearch'
import { ApiError } from '@/services/api'
import { useThreadStore } from '@/stores/thread'
import type { ProductSearchResponse } from '@/types/generated'

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
 * Setup-store for the free-text product search feature (2026-08-20 roadmap
 * decision). Kept **separate** from `stores/thread.ts` to preserve that
 * store's current single responsibility (owning the analysis thread's
 * messages) — this store depends on `useThreadStore().threadId`, creating
 * one via `startThread()` if absent, the same defensive pattern
 * `submitQuery` already uses for the exact same "user deep-linked/refreshed
 * past the landing page" case.
 */
export const useSearchStore = defineStore('search', () => {
  // --- state ---
  const queryText = ref('')
  const result = ref<ProductSearchResponse | null>(null)
  const loading = ref(false)
  const error = ref<ApiError | null>(null)

  const productSearch = useProductSearch()

  // Discards a stale in-flight response if a newer runSearch() has since
  // started — mirrors `stores/thread.ts`'s identical `requestSeq` guard.
  let requestSeq = 0

  // --- actions ---
  function reset(): void {
    requestSeq += 1
    queryText.value = ''
    result.value = null
    loading.value = false
    error.value = null
  }

  /** POST /threads/{id}/search (docs/PLAN.md's 2026-08-20 roadmap decision). */
  async function runSearch(text: string): Promise<void> {
    const seq = ++requestSeq
    queryText.value = text
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
        throw new Error('useSearchStore.runSearch: no thread id available after startThread().')
      }

      const response = await productSearch.search(threadId, { query_text: text })
      if (seq !== requestSeq) return
      result.value = response
    } catch (caught) {
      if (seq !== requestSeq) return
      error.value = toApiError(caught)
    } finally {
      if (seq === requestSeq) loading.value = false
    }
  }

  return { queryText, result, loading, error, reset, runSearch }
})
