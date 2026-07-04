import { GET } from './route'
import { staleCache } from '@/lib/krl/adapter'
import { KciStationRow } from '@/lib/krl/types'

interface MockResponse {
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
  clone: () => MockResponse
}

function createFetchResponse(data: unknown, ok = true, status = 200): MockResponse {
  const response: MockResponse = {
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    clone: () => response,
  }
  return response
}

function createStationRow(overrides: Partial<KciStationRow> = {}): KciStationRow {
  return {
    sta_id: 'STA1',
    sta_name: 'STATION ONE',
    group_wil: 0,
    fg_enable: 1,
    ...overrides,
  }
}

function createRegionHeader(name: string): KciStationRow {
  return {
    sta_id: 'WIL0',
    sta_name: name,
    group_wil: 0,
    fg_enable: 0,
  }
}

beforeEach(() => {
  jest.restoreAllMocks()
  staleCache.clear()
})

describe('GET /api/v1/krl/stations', () => {
  test('returns 200 with stations grouped by region', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        status: 200,
        message: 'success',
        data: [
          createRegionHeader('AREA JABODETABEK'),
          createStationRow({ sta_id: 'AC', sta_name: 'ANCOL' }),
          createStationRow({ sta_id: 'BPR', sta_name: 'BOGOR PALEDANG' }),
          createRegionHeader('AREA YOGYAKARTA'),
          createStationRow({ sta_id: 'YK', sta_name: 'YOGYAKARTA' }),
        ],
      })
    )

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual({
      Jabodetabek: [
        { id: 'AC', name: 'Ancol' },
        { id: 'BPR', name: 'Bogor Paledang' },
      ],
      Yogyakarta: [{ id: 'YK', name: 'Yogyakarta' }],
    })
    expect(body.error).toBeNull()
  })

  test('returns 502 on upstream error', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({}, false, 404)
    )

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.data).toBeNull()
    expect(body.error).toEqual({
      status: 502,
      message: 'Upstream returned HTTP 404',
    })
  })

  test('returns 500 on unexpected error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Boom'))

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.data).toBeNull()
    expect(body.error).toEqual({
      status: 502,
      message: 'Upstream KRL API unavailable',
    })
  })
})
