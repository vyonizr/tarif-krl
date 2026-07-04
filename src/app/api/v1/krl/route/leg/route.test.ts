import { GET } from './route'

jest.mock('../../../../../../lib/krl/snapshotStore', () => ({
  getScheduleSnapshot: jest.fn(),
  getRepoScheduleSnapshot: jest.fn(),
  getTrainSnapshot: jest.fn(),
  getRepoTrainScheduleSnapshot: jest.fn(),
}))

const {
  getScheduleSnapshot,
  getRepoScheduleSnapshot,
  getTrainSnapshot,
  getRepoTrainScheduleSnapshot,
} = require('../../../../../../lib/krl/snapshotStore') as {
  getScheduleSnapshot: jest.Mock
  getRepoScheduleSnapshot: jest.Mock
  getTrainSnapshot: jest.Mock
  getRepoTrainScheduleSnapshot: jest.Mock
}

interface KciScheduleRow {
  train_id: string
  ka_name: string
  route_name: string
  dest: string
  time_est: string
  color: string
  dest_time: string
}

interface KciTrainScheduleRow {
  train_id: string
  ka_name: string
  station_id: string
  station_name: string
  time_est: string
  transit: string
  color: string
  transit_station: boolean
}

function createScheduleRow(overrides: Partial<KciScheduleRow> = {}): KciScheduleRow {
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

function createTrainRow(
  station_id: string,
  station_name: string,
  time_est: string,
  overrides: Partial<KciTrainScheduleRow> = {}
): KciTrainScheduleRow {
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

function makeRequest(url: string): Request {
  return new Request(new URL(url).toString())
}

function snapshot(data: KciScheduleRow[]) {
  return { data, capturedAt: '2025-01-01T00:01:00.000Z' }
}

function trainSnapshot(data: KciTrainScheduleRow[]) {
  return { data, capturedAt: '2025-01-01T00:01:00.000Z' }
}

beforeEach(() => {
  jest.restoreAllMocks()
})

describe('GET /api/v1/krl/route/leg', () => {
  test('returns 200 with legs for valid params', async () => {
    getScheduleSnapshot.mockResolvedValue(
      snapshot([createScheduleRow({ train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' })])
    )
    getRepoScheduleSnapshot.mockResolvedValue(null)
    getTrainSnapshot.mockResolvedValue(
      trainSnapshot([
        createTrainRow('JAKK', 'Jakarta Kota', '04:00:00', { color: '#E30A16' }),
        createTrainRow('MRI', 'Manggarai', '04:15:00', { color: '#E30A16' }),
      ])
    )
    getRepoTrainScheduleSnapshot.mockResolvedValue(null)

    const req = makeRequest('http://localhost/api/v1/krl/route/leg?from=JAKK&to=MRI&time=04:00')
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.legs).toHaveLength(1)
    expect(body.data.legs[0].train_id).toBe('1151')
    expect(body.error).toBeNull()
  })

  test('returns 400 when params are missing', async () => {
    const req = makeRequest('http://localhost/api/v1/krl/route/leg?from=JAKK&to=MRI')
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error?.message).toBe('Parameters "from", "to" and "time" are required')
  })

  test('returns 400 when from equals to', async () => {
    const req = makeRequest('http://localhost/api/v1/krl/route/leg?from=JAKK&to=JAKK&time=04:00')
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error?.message).toBe('Origin and destination must be different stations')
  })

  test('returns 400 for unknown station', async () => {
    const req = makeRequest('http://localhost/api/v1/krl/route/leg?from=XXXXX&to=JAKK&time=04:00')
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error?.message).toBe('Station not recognized for route lookup')
  })

  test('returns 404 when no route found', async () => {
    getScheduleSnapshot.mockResolvedValue(snapshot([]))
    getRepoScheduleSnapshot.mockResolvedValue(null)
    getTrainSnapshot.mockResolvedValue(null)
    getRepoTrainScheduleSnapshot.mockResolvedValue(null)

    const req = makeRequest('http://localhost/api/v1/krl/route/leg?from=JAKK&to=MRI&time=04:00')
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.data).toBeNull()
    expect(body.error).toBeDefined()
  })

  test('falls back to repo-snapshot when blob not available', async () => {
    getScheduleSnapshot.mockResolvedValue(null)
    getRepoScheduleSnapshot.mockResolvedValue(
      snapshot([createScheduleRow({ train_id: '1151', ka_name: 'COMMUTER LINE TANJUNG PRIOK', color: '#E30A16' })])
    )
    getTrainSnapshot.mockResolvedValue(null)
    getRepoTrainScheduleSnapshot.mockResolvedValue(
      trainSnapshot([
        createTrainRow('JAKK', 'Jakarta Kota', '04:00:00', { color: '#E30A16' }),
        createTrainRow('KPB', 'Kampung Bandan', '04:15:00', { color: '#E30A16' }),
      ])
    )

    const req = makeRequest('http://localhost/api/v1/krl/route/leg?from=JAKK&to=KPB&time=04:00')
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.error).toBeNull()
    expect(body.data.legs).toHaveLength(1)
    expect(body.data.legs[0].stops.at(-1).station_id).toBe('KPB')
    expect(response.headers.get('X-KRL-Data-Source')).toMatch(/^repo-snapshot/)
  })
})
