/**
 * The single HTTP client. Every future resource call funnels through
 * `apiRequest()`, never a bare `axios.request()` (pattern kept from the
 * reference repo's `services/api.js` — docs/CONVENTIONS.md §5).
 *
 * Envelope note: this backend's contract (docs/PLAN.md §3.2–§3.3) is Pydantic
 * response models, not the reference repo's generic `{status, data}` wrapper.
 * The reference repo's real insight — "the envelope decides success, not the
 * raw HTTP status" — is ported here as: *the presence of an `error_code`
 * field in the response body is what decides failure*, independent of
 * whatever HTTP status the backend used to send it. This still protects
 * against the same failure mode the reference repo guarded against (a 200
 * that is actually an error), without inventing a `status` field this
 * backend's schema doesn't have. `POST /threads/{id}/messages` additionally
 * wraps its body in a `{type, data}` envelope (docs/PLAN.md §3.3) — see
 * `unwrapEnvelope` below, which the error-detection path unwraps through
 * before checking for `error_code`, so an enveloped `ErrorResponse` is still
 * recognized correctly (Phase 4 finding ARCH-01/B1).
 */
import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'

import type { ErrorResponse, ResponseEnvelope } from '@/types/generated'

const REQUEST_TIMEOUT_MS = 15_000
const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.'
const NETWORK_ERROR_MESSAGE = 'Could not reach the server. Check your connection and try again.'
const TIMEOUT_ERROR_MESSAGE = 'The request took too long. Please try again.'

export interface ApiErrorOptions {
  httpStatus: number | null
  errorCode: string
  message: string
  retryable: boolean
  traceId: string | null
}

/** Normalized failure. Every rejected call throws one of these — never a raw AxiosError. */
export class ApiError extends Error {
  readonly httpStatus: number | null
  readonly errorCode: string
  readonly retryable: boolean
  readonly traceId: string | null

  constructor(options: ApiErrorOptions) {
    super(options.message || GENERIC_ERROR_MESSAGE)
    this.name = 'ApiError'
    this.httpStatus = options.httpStatus
    this.errorCode = options.errorCode
    this.retryable = options.retryable
    this.traceId = options.traceId
  }

  /** No response reached the caller at all — offline, DNS, CORS, connection reset. */
  get isNetworkError(): boolean {
    return this.httpStatus === null
  }

  get isTimeout(): boolean {
    return this.errorCode === 'UPSTREAM_TIMEOUT' || this.errorCode === 'CLIENT_TIMEOUT'
  }

  get isBudgetExceeded(): boolean {
    return this.errorCode === 'BUDGET_EXCEEDED'
  }

  get isRateLimited(): boolean {
    return this.httpStatus === 429
  }
}

/**
 * Type guard for a body shaped like `ErrorResponse` (docs/PLAN.md §3.2).
 * Exported for `useThread.ts`'s own defense-in-depth check (ARCH-01/B1) —
 * see that file's comment for why it re-checks this after `apiRequest`
 * already resolved, not just here.
 */
export function isErrorResponseBody(data: unknown): data is ErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error_code' in data &&
    'message' in data &&
    'retryable' in data &&
    'trace_id' in data
  )
}

/** Type guard for the `{type, data}` wire envelope (docs/PLAN.md §3.3, ARCH-01). */
function isResponseEnvelope(data: unknown): data is ResponseEnvelope {
  return typeof data === 'object' && data !== null && 'type' in data && 'data' in data
}

/**
 * `POST /threads/{id}/messages` wraps *every* response — success or error —
 * in a `{type: 'final', data: ...}` envelope (docs/PLAN.md §3.3; backend
 * fix landing alongside this one, ARCH-01). Other endpoints (e.g.
 * `POST /threads`) are not enveloped. Error detection below must unwrap
 * defensively so a genuine `ErrorResponse` nested at `body.data` is still
 * recognized — without this, `isErrorResponseBody` only ever sees the outer
 * `{type, data}` shape (no top-level `error_code`), silently misses every
 * enveloped error, and falls back to a lossy generic `UNKNOWN_ERROR` that
 * discards the backend's real error_code/message/retryable/trace_id. A body
 * that isn't enveloped passes through unchanged, so this stays correct for
 * `POST /threads`'s bare (non-enveloped) responses too.
 */
function unwrapEnvelope(data: unknown): unknown {
  return isResponseEnvelope(data) ? data.data : data
}

function fromErrorResponseBody(body: ErrorResponse, httpStatus: number | null): ApiError {
  return new ApiError({
    httpStatus,
    errorCode: body.error_code,
    message: body.message,
    retryable: body.retryable,
    traceId: body.trace_id,
  })
}

/** Turns a thrown AxiosError (no usable response body) into a normalized ApiError. */
function fromAxiosError(error: AxiosError): ApiError {
  const response = error.response
  if (!response) {
    const isTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
    return new ApiError({
      httpStatus: null,
      errorCode: isTimeout ? 'CLIENT_TIMEOUT' : 'NETWORK_ERROR',
      message: isTimeout ? TIMEOUT_ERROR_MESSAGE : NETWORK_ERROR_MESSAGE,
      retryable: true,
      traceId: null,
    })
  }

  const body = unwrapEnvelope(response.data)
  if (isErrorResponseBody(body)) {
    return fromErrorResponseBody(body, response.status)
  }

  return new ApiError({
    httpStatus: response.status,
    errorCode: 'UNKNOWN_ERROR',
    message: GENERIC_ERROR_MESSAGE,
    retryable: response.status >= 500,
    traceId: null,
  })
}

/** Substitutes `:param` placeholders in a path template, e.g. `/threads/:threadId`. */
export function buildPath(template: string, params: Record<string, string> = {}): string {
  return Object.entries(params).reduce(
    (path, [key, value]) => path.replace(`:${key}`, encodeURIComponent(value)),
    template,
  )
}

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Fallback for environments without crypto.randomUUID (older test runners).
  return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
})

/** Every outgoing request carries a client-generated request ID for trace correlation. */
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.headers.set('X-Request-ID', generateRequestId())
  return config
})

http.interceptors.response.use(
  (response) => {
    // A backend node can fail after already committing to a 2xx (e.g. output
    // guardrail rejection assembled late) — the body's error_code decides
    // failure, not the status code alone. See file header. Unwrap first
    // since POST /threads/{id}/messages wraps this in a {type, data}
    // envelope (docs/PLAN.md §3.3) — see unwrapEnvelope's own comment.
    const payload = unwrapEnvelope(response.data)
    if (isErrorResponseBody(payload)) {
      return Promise.reject(fromErrorResponseBody(payload, response.status))
    }
    return response
  },
  (error: AxiosError) => Promise.reject(fromAxiosError(error)),
)

export interface ApiRequestOptions<TBody = unknown> extends Omit<
  AxiosRequestConfig,
  'url' | 'method' | 'data'
> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: TBody
  /** `:param` substitutions applied to `path` via `buildPath()`. */
  params?: Record<string, string>
}

/**
 * Performs one request and returns the parsed body.
 *
 * @throws {ApiError}
 */
export async function apiRequest<TResponse, TBody = unknown>(
  path: string,
  options: ApiRequestOptions<TBody> = {},
): Promise<TResponse> {
  const { method = 'GET', body, params, ...rest } = options

  try {
    const response = await http.request<TResponse>({
      url: buildPath(path, params),
      method,
      data: body,
      ...rest,
    })
    return response.data
  } catch (thrown) {
    throw thrown instanceof ApiError ? thrown : fromAxiosError(thrown as AxiosError)
  }
}

export default http
