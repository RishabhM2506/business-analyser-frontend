import { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'

import { ApiError, apiRequest } from '@/services/api'
import type { ErrorResponse, ResponseEnvelope } from '@/types/generated'

import { FIXTURE_TRADE_ANALYSIS_RESPONSE } from '../fixtures/tradeAnalysisResponse'

// Regression coverage for Phase 4 finding ARCH-01/B1: the real backend wraps
// *every* POST /threads/{id}/messages response — success or error — in a
// `{type: 'final', data: ...}` envelope (docs/PLAN.md §3.3). Before this fix,
// api.ts's error detection only ever checked the raw top-level body for
// `error_code`, so an enveloped ErrorResponse (the real shape, once the
// parallel backend fix lands) was never recognized: it silently fell through
// to a lossy generic UNKNOWN_ERROR that discarded the backend's real
// error_code/message/retryable/trace_id. These tests exercise the *real*
// axios interceptor pipeline (services/api.ts's `http` instance), not a
// mocked `apiRequest` — a fake low-level `adapter` stands in for the network
// transport (the one part of axios that would otherwise make a real HTTP
// call), so the request/response interceptors that actually run in
// production run here too. This is deliberately not testable by mocking
// `apiRequest` itself (as most other spec files do) since that mocks away
// exactly the logic under test.

function fakeAdapter(status: number, data: unknown): AxiosAdapter {
  return (config) => {
    const response: AxiosResponse = {
      data,
      status,
      statusText: '',
      headers: {},
      config,
    }
    if (status >= 200 && status < 300) {
      return Promise.resolve(response)
    }
    // Real non-2xx responses reach axios's rejection path as an AxiosError
    // carrying the response — matching what the real XHR/http adapter does,
    // not what a plain rejected promise of the body alone would do.
    return Promise.reject(
      new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, undefined, response),
    )
  }
}

/**
 * Awaits a promise expected to reject with an `ApiError` and returns it,
 * typed as `ApiError` rather than `unknown` — avoids the
 * `Promise<T>.catch(handler)` pattern, whose inferred `T | ReturnType<handler>`
 * union collapses back to `unknown` whenever `T` itself is uninferrable
 * (exactly the case here, since these calls deliberately don't pin a success
 * type they never expect to see).
 */
async function captureApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (caught) {
    if (caught instanceof ApiError) {
      return caught
    }
    throw caught
  }
  throw new Error('Expected the request to reject, but it resolved.')
}

// Real wire payloads are unshaped (`unknown`) until parsed — these represent
// what actually arrives over HTTP, not a value already known to satisfy
// `ResponseEnvelope`'s strict `data: TradeAnalysisResponse` success shape.
// (`data.data` being an `ErrorResponse` is exactly the real shape the
// backend sends for a failed call, per ARCH-01's concrete fix — see
// app/main.py's `_model_response`.)
const REAL_ERROR_RESPONSE: ErrorResponse = {
  error_code: 'BUDGET_EXCEEDED',
  message: 'The model-call budget for this thread or day has been reached.',
  retryable: true,
  trace_id: 'trace-real-1',
}

const REAL_ERROR_ENVELOPE: unknown = { type: 'final', data: REAL_ERROR_RESPONSE }

describe('apiRequest / http interceptors — response envelope handling (ARCH-01/B1)', () => {
  it('resolves apiRequest<ResponseEnvelope> with the envelope intact on a real enveloped success body', async () => {
    const envelope: ResponseEnvelope = { type: 'final', data: FIXTURE_TRADE_ANALYSIS_RESPONSE }
    const result = await apiRequest<ResponseEnvelope>('/threads/:threadId/messages', {
      method: 'POST',
      params: { threadId: 't1' },
      adapter: fakeAdapter(200, envelope),
    })

    expect(result).toEqual(envelope)
  })

  it('rejects with a fully-populated ApiError (not a lossy UNKNOWN_ERROR) for a real enveloped error body on a non-2xx status', async () => {
    const error = await captureApiError(
      apiRequest('/threads/:threadId/messages', {
        method: 'POST',
        params: { threadId: 't1' },
        adapter: fakeAdapter(429, REAL_ERROR_ENVELOPE),
      }),
    )

    expect(error.errorCode).toBe('BUDGET_EXCEEDED')
    expect(error.message).toBe(REAL_ERROR_RESPONSE.message)
    expect(error.retryable).toBe(true)
    expect(error.traceId).toBe('trace-real-1')
    expect(error.httpStatus).toBe(429)
    // The bug this guards against: silently downgrading to a generic code
    // that loses the backend's real error_code/message/retryable/trace_id.
    expect(error.errorCode).not.toBe('UNKNOWN_ERROR')
  })

  it('still correctly parses a real, non-enveloped ErrorResponse body (e.g. POST /threads, which the backend does not envelope)', async () => {
    const error = await captureApiError(
      apiRequest('/threads', {
        method: 'POST',
        adapter: fakeAdapter(500, REAL_ERROR_RESPONSE),
      }),
    )

    expect(error.errorCode).toBe('BUDGET_EXCEEDED')
    expect(error.retryable).toBe(true)
    expect(error.traceId).toBe('trace-real-1')
  })

  it('rejects an enveloped ErrorResponse even when the backend commits to a 2xx status (defensive: error_code decides failure, not the HTTP status)', async () => {
    const error = await captureApiError(
      apiRequest('/threads/:threadId/messages', {
        method: 'POST',
        params: { threadId: 't1' },
        adapter: fakeAdapter(200, REAL_ERROR_ENVELOPE),
      }),
    )

    expect(error.errorCode).toBe('BUDGET_EXCEEDED')
  })

  it('falls back to a generic UNKNOWN_ERROR only for a body that is genuinely unrecognized (not merely enveloped)', async () => {
    const error = await captureApiError(
      apiRequest('/threads/:threadId/messages', {
        method: 'POST',
        params: { threadId: 't1' },
        adapter: fakeAdapter(500, { some: 'unrelated shape' }),
      }),
    )

    expect(error.errorCode).toBe('UNKNOWN_ERROR')
  })

  it('leaves genuine network-level failures (no response at all) unaffected by envelope unwrapping', async () => {
    const networkAdapter: AxiosAdapter = (config) =>
      Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config))

    const error = await captureApiError(
      apiRequest('/threads', { method: 'POST', adapter: networkAdapter }),
    )

    expect(error.isNetworkError).toBe(true)
    expect(error.errorCode).toBe('NETWORK_ERROR')
  })
})
