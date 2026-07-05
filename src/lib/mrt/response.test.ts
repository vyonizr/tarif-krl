import { ok, fail } from './response'
import { ApiEnvelope } from './types'

describe('response envelope', () => {
  describe('ok', () => {
    test('wraps a string value', () => {
      const result = ok('hello')
      expect(result).toEqual({ data: 'hello', error: null })
    })

    test('wraps an object value', () => {
      const result = ok({ id: 1, name: 'test' })
      expect(result).toEqual({ data: { id: 1, name: 'test' }, error: null })
    })

    test('wraps null data', () => {
      const result = ok(null)
      expect(result).toEqual({ data: null, error: null })
    })

    test('wraps an array', () => {
      const result = ok([1, 2, 3])
      expect(result).toEqual({ data: [1, 2, 3], error: null })
    })

    test('matches ApiEnvelope shape', () => {
      const result = ok(42)
      const envelope: ApiEnvelope<number> = result
      expect(envelope.data).toBe(42)
      expect(envelope.error).toBeNull()
    })
  })

  describe('fail', () => {
    test('wraps status and message', () => {
      const result = fail(400, 'Bad request')
      expect(result).toEqual({
        data: null,
        error: { status: 400, message: 'Bad request' },
      })
    })

    test('wraps 404 not found', () => {
      const result = fail(404, 'Not found')
      expect(result).toEqual({
        data: null,
        error: { status: 404, message: 'Not found' },
      })
    })

    test('wraps 500 server error', () => {
      const result = fail(500, 'Internal server error')
      expect(result).toEqual({
        data: null,
        error: { status: 500, message: 'Internal server error' },
      })
    })

    test('matches ApiEnvelope shape', () => {
      const result = fail(418, "I'm a teapot")
      const envelope: ApiEnvelope<never> = result
      expect(envelope.data).toBeNull()
      expect(envelope.error).toEqual({ status: 418, message: "I'm a teapot" })
    })
  })
})
