import { ApiEnvelope, FetchMeta } from './types'

function ok<T>(data: T): ApiEnvelope<T> {
  return { data, error: null }
}

function fail(status: number, message: string): ApiEnvelope<never> {
  return { data: null, error: { status, message } }
}

// Surfaces which tier served a response (live upstream, in-memory stale
// cache, or the daily Blob snapshot) so the client can show a staleness
// banner instead of presenting degraded data as authoritative.
function dataSourceHeaders(meta: FetchMeta): HeadersInit {
  const value = meta.capturedAt
    ? `${meta.source}; captured-at=${meta.capturedAt}`
    : meta.source
  return { 'X-KRL-Data-Source': value }
}

export { ok, fail, dataSourceHeaders }
