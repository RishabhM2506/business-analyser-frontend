import { describe, expect, it } from 'vitest'

import { useStreamingResponse } from '@/composables/useStreamingResponse'

import { FIXTURE_TRADE_ANALYSIS_RESPONSE } from '../fixtures/tradeAnalysisResponse'

describe('useStreamingResponse', () => {
  it('starts with a null result and isStreaming false', () => {
    const { result, isStreaming } = useStreamingResponse()
    expect(result.value).toBeNull()
    expect(isStreaming.value).toBe(false)
  })

  it('a "final" chunk sets result to the chunk data and clears isStreaming', () => {
    const { result, isStreaming, handleChunk } = useStreamingResponse()
    handleChunk({ type: 'final', data: FIXTURE_TRADE_ANALYSIS_RESPONSE })
    // Vue's ref() wraps an assigned object in a reactive Proxy, so this is
    // deep-equal rather than the exact same reference — expected, not a bug.
    expect(result.value).toEqual(FIXTURE_TRADE_ANALYSIS_RESPONSE)
    expect(isStreaming.value).toBe(false)
  })

  it('a "delta" chunk is a documented no-op today: it does not populate result, only flips isStreaming', () => {
    const { result, isStreaming, handleChunk } = useStreamingResponse()
    handleChunk({ type: 'delta', data: { anything: 'unshaped' } })
    expect(result.value).toBeNull()
    expect(isStreaming.value).toBe(true)
  })

  it('reset() clears both result and isStreaming back to their initial values', () => {
    const { result, isStreaming, handleChunk, reset } = useStreamingResponse()
    handleChunk({ type: 'final', data: FIXTURE_TRADE_ANALYSIS_RESPONSE })

    reset()

    expect(result.value).toBeNull()
    expect(isStreaming.value).toBe(false)
  })

  it('each call to the composable returns independent state (not a cross-call singleton)', () => {
    const first = useStreamingResponse()
    const second = useStreamingResponse()
    first.handleChunk({ type: 'final', data: FIXTURE_TRADE_ANALYSIS_RESPONSE })
    expect(second.result.value).toBeNull()
  })
})
