import { GET } from './route'
import { staleCache } from '@/lib/krl/adapter'

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

function makeRequest(url: string): Request {
  return new Request(new URL(url).toString())
}

beforeEach(() => {
  jest.restoreAllMocks()
  staleCache.clear()
})

describe('GET /api/v1/krl/schedules', () => {
  test('returns 200 with schedules for valid params', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        status: 200,
        data: [
          {
            train_id: '1',
            ka_name: 'COMMUTER LINE BOGOR',
            route_name: 'BOGOR - JAKARTA',
            dest: 'BOGOR',
            time_est: '10:00:00',
            color: '#E30A16',
            dest_time: '10:30:00',
          },
        ],
      })
    )

    const req = makeRequest(
      'http://localhost/api/v1/krl/schedules?station_id=AC&time_from=10:00'
    )
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].train_id).toBe('1')
    expect(body.error).toBeNull()
  })

  test('returns 400 when station_id is missing', async () => {
    const req = makeRequest(
      'http://localhost/api/v1/krl/schedules?time_from=10:00'
    )
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.data).toBeNull()
    expect(body.error?.message).toBe(
      'Parameters "station_id" and "time_from" are required'
    )
  })

  test('returns 400 when time_from is missing', async () => {
    const req = makeRequest(
      'http://localhost/api/v1/krl/schedules?station_id=AC'
    )
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.data).toBeNull()
  })

  test('filters out non-passenger trains', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        status: 200,
        data: [
          {
            train_id: '1',
            ka_name: 'COMMUTER LINE BOGOR',
            route_name: 'BOGOR - JAKARTA',
            dest: 'BOGOR',
            time_est: '10:00:00',
            color: '#E30A16',
            dest_time: '10:30:00',
          },
          {
            train_id: '2',
            ka_name: 'TIDAK ANGKUT PENUMPANG',
            route_name: '',
            dest: 'DEPOK',
            time_est: '10:05:00',
            color: '#000',
            dest_time: '10:35:00',
          },
        ],
      })
    )

    const req = makeRequest(
      'http://localhost/api/v1/krl/schedules?station_id=AC&time_from=10:00'
    )
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].train_id).toBe('1')
  })

  test('returns 502 on upstream error', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({}, false, 500)
    )

    const req = makeRequest(
      'http://localhost/api/v1/krl/schedules?station_id=AC&time_from=10:00'
    )
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.data).toBeNull()
    expect(body.error?.status).toBe(502)
  })
})
