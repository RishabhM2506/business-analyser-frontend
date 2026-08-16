import { ref, type Ref } from 'vue'

import type { ResponseEnvelope, TradeAnalysisResponse } from '@/types/generated'

export interface UseStreamingResponseReturn {
  result: Ref<TradeAnalysisResponse | null>
  isStreaming: Ref<boolean>
  /** Renders the envelope's `type` discriminator — chunk-ready even though v1 sends one `"final"` chunk. */
  handleChunk: (chunk: ResponseEnvelope) => void
  /** Clears `result`/`isStreaming` — call before feeding chunks for a new request so a stale result can't leak through. */
  reset: () => void
}

/**
 * v1's backend sends the entire `TradeAnalysisResponse` as a single
 * `type: "final"` envelope (docs/PLAN.md §3.3) — there is no real streaming
 * transport yet, `useThread.sendMessage` just calls `handleChunk` once with
 * that single envelope. `type: "delta"` isn't specified by the backend yet
 * (deliberately not fabricated — see the `ResponseEnvelope` type), so it's a
 * documented no-op: wiring a real incremental renderer later is additive
 * (new case body), not a rewrite of this composable's shape.
 */
export function useStreamingResponse(): UseStreamingResponseReturn {
  const result = ref<TradeAnalysisResponse | null>(null)
  const isStreaming = ref(false)

  function handleChunk(chunk: ResponseEnvelope): void {
    switch (chunk.type) {
      case 'final':
        result.value = chunk.data
        isStreaming.value = false
        break
      case 'delta':
        // TODO(Phase 3+): shape not yet defined by the backend (docs/PLAN.md
        // §3.3) — no-op until a real streaming transport exists to drive it.
        isStreaming.value = true
        break
      default:
        // Exhaustiveness guard: a new envelope `type` was added to
        // types/generated.ts without teaching this composable about it.
        chunk satisfies never
    }
  }

  function reset(): void {
    result.value = null
    isStreaming.value = false
  }

  return { result, isStreaming, handleChunk, reset }
}
