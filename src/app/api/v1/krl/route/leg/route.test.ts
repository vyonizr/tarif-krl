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

function createScheduleRow(overrides: Partial<{
  train_id: string
  ka_name: string
  color: string
  time_est: string
}> = {}) {
  return {
    train_id: '1151',
    ka_name: 'COMMUTER LINE BOGOR',
    route_name: 'BOGOR - JAKARTA',
    dest: 'Jakarta Kota',
    time_est: '04:00:00',
    color: '#E30A16',
    dest_time: '05:30:00',
    ...overrides,
  }
}

function createTrainScheduleRow(
  station_id: string,
  station_name: string,
  time_est: string,
  overrides: Partial<{ color: string }> = {}
) {
  return {
    train_id: '1151',
    ka_name: 'COMMUTER LINE BOGOR',
    station_id,
    station_name,
    time_est,
    transit: '',
    color: '#E30A16',
    transit_station: false,
    ...overrides,
  }
}

beforeEach(() => {
  jest.restoreAllMocks()
  staleCache.clear()
})

describe('GET /api/v1/krl/route/leg', () => {
  test('returns 200 with legs for valid params', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/schedules')) {
        return Promise.resolve(
          createFetchResponse({
            status: 200,
            data: [
              createScheduleRow({
                train_id: '1151',
                ka_name: 'COMMUTER LINE BOGOR',
                color: '#E30A16',
              }),
            ],
          })
        )
      }
      if (url.includes('/train-schedule')) {
        return Promise.resolve(
          createFetchResponse({
            status: 200,
            data: [
              createTrainScheduleRow('JAKK', 'Jakarta Kota', '04:00:00', {
                color: '#E30A16',
              }),
              createTrainScheduleRow('MRI', 'Manggarai', '04:15:00', {
                color: '#E30A16',
              }),
            ],
          })
        )
      }
      return Promise.reject(new Error('Unexpected URL'))
    })

    const req = makeRequest(
      'http://localhost/api/v1/krl/route/leg?from=JAKK&to=MRI&time=04:00'
    )
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.legs).toHaveLength(1)
    expect(body.data.legs[0].train_id).toBe('1151')
    expect(body.error).toBeNull()
  })

  test('returns 400 when params are missing', async () => {
    const req = makeRequest(
      'http://localhost/api/v1/krl/route/leg?from=JAKK&to=MRI'
    )
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error?.message).toBe(
      'Parameters "from", "to" and "time" are required'
    )
  })

  test('returns 400 when from equals to', async () => {
    const req = makeRequest(
      'http://localhost/api/v1/krl/route/leg?from=JAKK&to=JAKK&time=04:00'
    )
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error?.message).toBe(
      'Origin and destination must be different stations'
    )
  })

  test('returns 400 for unknown station', async () => {
    const req = makeRequest(
      'http://localhost/api/v1/krl/route/leg?from=XXXXX&to=JAKK&time=04:00'
    )
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error?.message).toBe(
      'Station not recognized for route lookup'
    )
  })

  test('returns 404 when no route found', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/schedules')) {
        return Promise.resolve(
          createFetchResponse({ status: 200, data: [] })
        )
      }
      return Promise.reject(new Error('Unexpected URL'))
    })

    const req = makeRequest(
      'http://localhost/api/v1/krl/route/leg?from=JAKK&to=MRI&time=04:00'
    )
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.data).toBeNull()
    expect(body.error).toBeDefined()
  })

  test('returns 502 on upstream error', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({}, false, 500)
    )

    const req = makeRequest(
      'http://localhost/api/v1/krl/route/leg?from=JAKK&to=MRI&time=04:00'
    )
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.data).toBeNull()
    expect(body.error?.status).toBe(502)
  })
})
