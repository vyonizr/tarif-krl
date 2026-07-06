/// <reference types="jest" />

import { GET } from './route'

jest.mock('../../../../lib/lrt/adapter', () => ({
  getSchedule: jest.fn(),
}))

const { getSchedule } = require('../../../../lib/lrt/adapter') as {
  getSchedule: jest.Mock
}

beforeEach(() => {
  getSchedule.mockReset()
})

function createRequest(params: Record<string, string>): Request {
  const url = new URL('https://example.com/api/lrt/schedule')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new Request(url.toString())
}

describe('GET /api/lrt/schedule', () => {
  test('returns 200 with the departure time list', async () => {
    getSchedule.mockResolvedValue(['05:39', '05:43'])

    const response = await GET(createRequest({ station: 'cawang', day: 'weekday' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual(['05:39', '05:43'])
    expect(getSchedule).toHaveBeenCalledWith('cawang', 'weekday')
  })

  test('returns 400 when station param is missing', async () => {
    const response = await GET(createRequest({ day: 'weekday' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toEqual({
      status: 400,
      message: 'Parameters "station" and "day" are required',
    })
  })

  test('returns 400 when day param is missing', async () => {
    const response = await GET(createRequest({ station: 'cawang' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toEqual({
      status: 400,
      message: 'Parameters "station" and "day" are required',
    })
  })

  test('returns 400 when day param is invalid', async () => {
    const response = await GET(createRequest({ station: 'cawang', day: 'tuesday' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toEqual({
      status: 400,
      message: 'Parameter "day" must be "weekday" or "holiday"',
    })
  })

  test('returns 400 when station is unknown', async () => {
    const response = await GET(createRequest({ station: 'nowhere', day: 'weekday' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toEqual({ status: 400, message: 'Unknown station: nowhere' })
  })

  test('returns 404 when no snapshot exists for the station', async () => {
    getSchedule.mockResolvedValue(null)

    const response = await GET(createRequest({ station: 'cawang', day: 'weekday' }))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toEqual({
      status: 404,
      message: 'No schedule snapshot for station: cawang',
    })
  })

  test('returns 500 when the adapter throws', async () => {
    getSchedule.mockRejectedValue(new Error('read failed'))

    const response = await GET(createRequest({ station: 'cawang', day: 'weekday' }))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toEqual({ status: 500, message: 'read failed' })
  })
})
