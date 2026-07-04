import { GET } from './route'

jest.mock('../../../../lib/krl/adapter', () => ({
  getStations: jest.fn(),
}))

jest.mock('../../../../lib/krl/snapshotStore', () => ({
  getScheduleSnapshot: jest.fn(),
  setScheduleSnapshot: jest.fn(),
  getTrainSnapshot: jest.fn(),
  setTrainSnapshot: jest.fn(),
}))

const { getStations } = require('../../../../lib/krl/adapter') as { getStations: jest.Mock }
const {
  getScheduleSnapshot,
  setScheduleSnapshot,
  getTrainSnapshot,
  setTrainSnapshot,
} = require('../../../../lib/krl/snapshotStore') as {
  getScheduleSnapshot: jest.Mock
  setScheduleSnapshot: jest.Mock
  getTrainSnapshot: jest.Mock
  setTrainSnapshot: jest.Mock
}

interface MockResponse {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

function createFetchResponse(data: unknown, ok = true, status = 200): MockResponse {
  return {
    ok,
    status,
    json: () => Promise.resolve(data),
  }
}

function makeRequest(authHeader?: string): Request {
  return new Request('http://localhost/api/cron/warm-schedules', {
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  delete process.env.CRON_SECRET
  getScheduleSnapshot.mockResolvedValue(null)
  setScheduleSnapshot.mockResolvedValue(undefined)
  getTrainSnapshot.mockResolvedValue(null)
  setTrainSnapshot.mockResolvedValue(undefined)
  getStations.mockResolvedValue({
    Jabodetabek: [
      { id: 'JAKK', name: 'Jakarta Kota' },
      { id: 'MRI', name: 'Manggarai' },
    ],
  })
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (url.includes('/schedules')) {
      return Promise.resolve(createFetchResponse({
        status: 200,
        data: [{ train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', time_est: '04:00:00', color: '#E30A16', route_name: '', dest: '', dest_time: '' }],
      }))
    }
    if (url.includes('/train-schedule')) {
      return Promise.resolve(createFetchResponse({
        status: 200,
        data: [{ train_id: '1151', station_id: 'JAKK', station_name: 'Jakarta Kota', time_est: '04:00:00', ka_name: '', transit: '', color: '#E30A16', transit_station: false }],
      }))
    }
    return Promise.reject(new Error('Unexpected URL'))
  })
})

describe('GET /api/cron/warm-schedules', () => {
  test('rejects requests missing the cron secret when one is configured', async () => {
    process.env.CRON_SECRET = 'topsecret'

    const response = await GET(makeRequest())

    expect(response.status).toBe(401)
    expect(getStations).not.toHaveBeenCalled()
  })

  test('accepts requests with a matching cron secret', async () => {
    process.env.CRON_SECRET = 'topsecret'

    const response = await GET(makeRequest('Bearer topsecret'))

    expect(response.status).toBe(200)
  })

  test('scrapes every station and train, writes both snapshot types', async () => {
    const response = await GET(makeRequest())
    const body = await response.json()

    expect(setScheduleSnapshot).toHaveBeenCalledTimes(2)
    expect(setTrainSnapshot).toHaveBeenCalledTimes(1)
    expect(body.results.stations).toBe('ok=2 fail=0')
    expect(body.results.trains).toBe('ok=1 fail=0')
  })

  test('returns error when station list fetch fails', async () => {
    getStations.mockRejectedValue(new Error('KCI down'))

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.error).toContain('KCI down')
  })

  test('isolates a single station failure — other stations still warm', async () => {
    let failOnce = true
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/schedules') && url.includes('stationid=JAKK') && failOnce) {
        failOnce = false
        return Promise.reject(new Error('timeout'))
      }
      if (url.includes('/schedules')) {
        return Promise.resolve(createFetchResponse({
          status: 200,
          data: [{ train_id: '1151', ka_name: 'COMMUTER LINE', time_est: '04:00:00', color: '#000', route_name: '', dest: '', dest_time: '' }],
        }))
      }
      if (url.includes('/train-schedule')) {
        return Promise.resolve(createFetchResponse({
          status: 200,
          data: [{ train_id: '1151', station_id: 'MRI', station_name: 'Manggarai', time_est: '04:00:00', ka_name: '', transit: '', color: '#000', transit_station: false }],
        }))
      }
      return Promise.reject(new Error('Unexpected URL'))
    })

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.results.stations).toContain('fail=1')
    expect(body.results.stations).toContain('ok=1')
  })
})
