import type { Ref } from 'vue'

import type { ResponseEnvelope, TradeAnalysisResponse } from '@/types/generated'

export interface UseStreamingResponseReturn {
  result: Ref<TradeAnalysisResponse | null>
  isStreaming: Ref<boolean>
  /** Renders the envelope's `type` discriminator — chunk-ready even though v1 sends one `"final"` chunk. */
  handleChunk: (chunk: ResponseEnvelope) => void
}

// TODO(Phase 3): v1 backend sends a single `type: "final"` chunk; implement
// that path first, leave `type: "delta"` as a documented no-op until the
// backend actually streams (docs/PLAN.md §3.3).
export function useStreamingResponse(): UseStreamingResponseReturn {
  throw new Error('not implemented')
}
