import { ok, fail } from './response'
import { ApiEnvelope } from './types'

describe('response envelope', () => {
  describe('ok', () => {
    test('wraps an object value', () => {
      const result = ok({ id: 1, name: 'test' })
      expect(result).toEqual({ data: { id: 1, name: 'test' }, error: null })
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

    test('matches ApiEnvelope shape', () => {
      const result = fail(404, 'Not found')
      const envelope: ApiEnvelope<never> = result
      expect(envelope.data).toBeNull()
      expect(envelope.error).toEqual({ status: 404, message: 'Not found' })
    })
  })
})
