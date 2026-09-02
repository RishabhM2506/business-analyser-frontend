import { ref, type Ref } from 'vue'

import { apiRequest } from '@/services/api'
import { API_URLS } from '@/constants/apis'
import type { TradeReportQuery, TradeReportResponse } from '@/types/generated'

export interface UseTradeReportReturn {
  isLoading: Ref<boolean>
  /**
   * POST /threads/{id}/trade-report — India trade-report pipeline (duty
   * verification, mandi price, MSP, international production). Bare
   * response, not `{type, data}`-enveloped — mirrors `useProductSearch.ts`
   * exactly, including taking `threadId` as a parameter rather than owning
   * thread identity itself.
   */
  fetchReport: (threadId: string, query: TradeReportQuery) => Promise<TradeReportResponse>
}

/** Thin wrapper around `POST /threads/{id}/trade-report`, mirroring `useProductSearch.ts`'s shape. */
export function useTradeReport(): UseTradeReportReturn {
  const isLoading = ref(false)

  async function fetchReport(
    threadId: string,
    query: TradeReportQuery,
  ): Promise<TradeReportResponse> {
    isLoading.value = true
    try {
      return await apiRequest<TradeReportResponse, TradeReportQuery>(API_URLS.POST_TRADE_REPORT, {
        method: 'POST',
        params: { threadId },
        body: query,
      })
    } finally {
      isLoading.value = false
    }
  }

  return { isLoading, fetchReport }
}
