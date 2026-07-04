import { GET } from './route'

jest.mock('../../../../../lib/krl/snapshotStore', () => ({
  getScheduleSnapshot: jest.fn(),
  getRepoScheduleSnapshot: jest.fn(),
  getTrainSnapshot: jest.fn(),
  getRepoTrainScheduleSnapshot: jest.fn(),
}))

const {
  getScheduleSnapshot,
} = require('../../../../../lib/krl/snapshotStore') as {
  getScheduleSnapshot: jest.Mock
}

function makeRequest(url: string): Request {
  return new Request(new URL(url).toString())
}

function snapshot(data: unknown[]) {
  return { data, capturedAt: '2025-01-01T00:01:00.000Z' }
}

beforeEach(() => {
  jest.restoreAllMocks()
})

describe('GET /api/v1/krl/schedules', () => {
  test('returns 200 with schedules for valid params', async () => {
    getScheduleSnapshot.mockResolvedValue(
      snapshot([
        {
          train_id: '1',
          ka_name: 'COMMUTER LINE BOGOR',
          route_name: 'BOGOR - JAKARTA',
          dest: 'BOGOR',
          time_est: '10:00:00',
          color: '#E30A16',
          dest_time: '10:30:00',
        },
      ])
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
    getScheduleSnapshot.mockResolvedValue(
      snapshot([
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
      ])
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
})
