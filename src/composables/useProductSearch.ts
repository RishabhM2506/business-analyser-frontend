import { ref, type Ref } from 'vue'

import { apiRequest } from '@/services/api'
import { API_URLS } from '@/constants/apis'
import type { ProductSearchQuery, ProductSearchResponse } from '@/types/generated'

export interface UseProductSearchReturn {
  isLoading: Ref<boolean>
  /**
   * POST /threads/{id}/search — free-text product search (2026-08-20
   * roadmap decision). Bare response, not `{type, data}`-enveloped — see
   * `types/generated.ts`'s `ProductSearchResponse` doc comment.
   */
  search: (threadId: string, query: ProductSearchQuery) => Promise<ProductSearchResponse>
}

/**
 * Thin wrapper around `POST /threads/{id}/search`, mirroring `useThread.ts`'s
 * shape. Deliberately takes `threadId` as a parameter (unlike
 * `useThread.sendMessage`, which closes over its own `threadId` ref) since
 * this composable is not itself the owner of thread identity —
 * `stores/search.ts` depends on `useThreadStore().threadId` for that, the
 * same defensive "create one if absent" pattern `submitQuery` already uses.
 */
export function useProductSearch(): UseProductSearchReturn {
  const isLoading = ref(false)

  async function search(
    threadId: string,
    query: ProductSearchQuery,
  ): Promise<ProductSearchResponse> {
    isLoading.value = true
    try {
      return await apiRequest<ProductSearchResponse, ProductSearchQuery>(API_URLS.POST_SEARCH, {
        method: 'POST',
        params: { threadId },
        body: query,
      })
    } finally {
      isLoading.value = false
    }
  }

  return { isLoading, search }
}
