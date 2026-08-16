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

const REAL_ERROR_RESPONSE: ErrorResponse = {
  error_code: 'BUDGET_EXCEEDED',
  message: 'The model-call budget for this thread or day has been reached.',
  retryable: true,
  trace_id: 'trace-real-1',
}

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
    const envelope: ResponseEnvelope & { data: ErrorResponse } = {
      type: 'final',
      data: REAL_ERROR_RESPONSE,
    }

    const failure = apiRequest('/threads/:threadId/messages', {
      method: 'POST',
      params: { threadId: 't1' },
      adapter: fakeAdapter(429, envelope),
    })

    await expect(failure).rejects.toBeInstanceOf(ApiError)
    const error = await failure.catch((caught: unknown) => caught as ApiError)
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
    const failure = apiRequest('/threads', {
      method: 'POST',
      adapter: fakeAdapter(500, REAL_ERROR_RESPONSE),
    })

    const error = await failure.catch((caught: unknown) => caught as ApiError)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.errorCode).toBe('BUDGET_EXCEEDED')
    expect(error.retryable).toBe(true)
    expect(error.traceId).toBe('trace-real-1')
  })

  it('rejects an enveloped ErrorResponse even when the backend commits to a 2xx status (defensive: error_code decides failure, not the HTTP status)', async () => {
    const envelope: ResponseEnvelope & { data: ErrorResponse } = {
      type: 'final',
      data: REAL_ERROR_RESPONSE,
    }

    const failure = apiRequest('/threads/:threadId/messages', {
      method: 'POST',
      params: { threadId: 't1' },
      adapter: fakeAdapter(200, envelope),
    })

    const error = await failure.catch((caught: unknown) => caught as ApiError)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.errorCode).toBe('BUDGET_EXCEEDED')
  })

  it('falls back to a generic UNKNOWN_ERROR only for a body that is genuinely unrecognized (not merely enveloped)', async () => {
    const failure = apiRequest('/threads/:threadId/messages', {
      method: 'POST',
      params: { threadId: 't1' },
      adapter: fakeAdapter(500, { some: 'unrelated shape' }),
    })

    const error = await failure.catch((caught: unknown) => caught as ApiError)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.errorCode).toBe('UNKNOWN_ERROR')
  })

  it('leaves genuine network-level failures (no response at all) unaffected by envelope unwrapping', async () => {
    const networkAdapter: AxiosAdapter = (config) =>
      Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config))

    const failure = apiRequest('/threads', { method: 'POST', adapter: networkAdapter })
    const error = await failure.catch((caught: unknown) => caught as ApiError)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.isNetworkError).toBe(true)
    expect(error.errorCode).toBe('NETWORK_ERROR')
  })
})
