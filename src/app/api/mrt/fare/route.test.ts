/// <reference types="jest" />

import { GET } from './route'
import { MrtRouteResponse } from '@/lib/mrt/types'

interface MockResponse {
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
}

function createFetchResponse(
  data: unknown,
  ok = true,
  status = 200
): MockResponse {
  return {
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  }
}

function createRouteResponse(): MrtRouteResponse {
  return {
    success: true,
    data: {
      from: {
        id: 4,
        name: 'Stasiun MRT Lebak Bulus',
        object: {
          schedule: {
            start: 'Lebak Bulus',
            end: 'Bundaran HI',
            weekdaysStart: '',
            weekdaysEnd: '05:00:00;05:15:00',
            weekendsStart: '',
            weekendsEnd: '06:00:00',
          },
        },
      },
      to: {
        id: 6,
        name: 'Bundaran HI Bank Jakarta',
        object: {},
      },
      integration: {
        cost: 14000,
        timeEstimation: '30',
      },
    },
  }
}

beforeEach(() => {
  jest.restoreAllMocks()
})

function createRequest(params: Record<string, string>): Request {
  const url = new URL('https://example.com/api/mrt/fare')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new Request(url.toString())
}

describe('GET /api/mrt/fare', () => {
  test('returns 200 with fare, timeEstimation, direction, and schedule in data envelope', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(createFetchResponse(createRouteResponse()))

    const response = await GET(createRequest({ from: '4', to: '6' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.fare).toBe(14000)
    expect(body.data.timeEstimation).toBe(30)
    expect(body.data.direction).toEqual({
      start: 'Lebak Bulus',
      end: 'Bundaran HI',
    })
    expect(body.data.schedule.weekdays).toEqual(['05:00:00', '05:15:00'])
    expect(body.error).toBeNull()
  })

  test('returns 400 when from param is missing', async () => {
    const response = await GET(createRequest({ to: '6' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.data).toBeNull()
    expect(body.error).toEqual({
      status: 400,
      message: 'Parameters "from" and "to" are required',
    })
  })

  test('returns 400 when to param is missing', async () => {
    const response = await GET(createRequest({ from: '4' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.data).toBeNull()
    expect(body.error).toEqual({
      status: 400,
      message: 'Parameters "from" and "to" are required',
    })
  })

  test('returns 500 with error envelope on upstream failure', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(createFetchResponse({}, false, 500))

    const response = await GET(createRequest({ from: '4', to: '6' }))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.data).toBeNull()
    expect(body.error).toEqual({
      status: 500,
      message: 'Upstream returned HTTP 500',
    })
  })

  test('returns 500 with error envelope on network error', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('Network error'))

    const response = await GET(createRequest({ from: '4', to: '6' }))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.data).toBeNull()
    expect(body.error).toEqual({
      status: 500,
      message: 'Network error',
    })
  })

  test('passes datetime to adapter when provided', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(createFetchResponse(createRouteResponse()))

    await GET(
      createRequest({
        from: '4',
        to: '6',
        datetime: '2025-01-01T12:00:00',
      })
    )

    const [, options] = (global.fetch as jest.Mock).mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.datetime).toBe('2025-01-01T12:00:00')
  })
})
