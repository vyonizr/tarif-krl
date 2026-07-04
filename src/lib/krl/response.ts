import { ApiEnvelope } from './types'

function ok<T>(data: T): ApiEnvelope<T> {
  return { data, error: null }
}

function fail(status: number, message: string): ApiEnvelope<never> {
  return { data: null, error: { status, message } }
}

export { ok, fail }
