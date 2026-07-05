/// <reference types="jest" />

import { GET } from './route'
import { IMRTStation } from '@/lib/mrt/types'

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

function createStation(
  id: number,
  slug: string,
  name: string
): IMRTStation {
  return { id, slug, name }
}

beforeEach(() => {
  jest.restoreAllMocks()
})

describe('GET /api/mrt/stations', () => {
  test('returns 200 with stations in data envelope', async () => {
    const stations = [
      createStation(4, 'stasiun-lebak-bulus', 'Stasiun MRT Lebak Bulus'),
      createStation(5, 'stasiun-asean', 'ASEAN Headquarter'),
    ]

    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({ data: stations })
    )

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual(stations)
    expect(body.error).toBeNull()
  })

  test('returns 500 with error envelope on upstream failure', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(createFetchResponse({}, false, 500))

    const response = await GET()
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

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.data).toBeNull()
    expect(body.error).toEqual({
      status: 500,
      message: 'Network error',
    })
  })
})
