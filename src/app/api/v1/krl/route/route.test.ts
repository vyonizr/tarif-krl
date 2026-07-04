import { GET } from './route'

jest.mock('../../../../../lib/krl/snapshotStore', () => ({
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
} = require('../../../../../lib/krl/snapshotStore') as {
  getScheduleSnapshot: jest.Mock
  getRepoScheduleSnapshot: jest.Mock
  getTrainSnapshot: jest.Mock
  getRepoTrainScheduleSnapshot: jest.Mock
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

function createTrainRow(
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

function scheduleSnapshot(data: unknown[]) {
  return { data, capturedAt: '2025-01-01T00:01:00.000Z' }
}

function trainSnapshot(data: unknown[]) {
  return { data, capturedAt: '2025-01-01T00:01:00.000Z' }
}

function parseSSE(text: string) {
  const chunks = text.trim().split('\n\n')
  return chunks.map((chunk) => {
    const lines = chunk.split('\n')
    const event = lines.find((l) => l.startsWith('event:'))?.replace('event: ', '') ?? ''
    const dataLine = lines.find((l) => l.startsWith('data:'))
    const data = dataLine ? JSON.parse(dataLine.replace('data: ', '')) : null
    return { event, data }
  })
}

beforeEach(() => {
  jest.restoreAllMocks()
})

describe('GET /api/v1/krl/route (SSE)', () => {
  test('returns 400 when from is missing', async () => {
    const req = makeRequest('http://localhost/api/v1/krl/route?to=JAKK&time=10:00')
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error?.message).toBe('Parameters "from" and "to" are required')
  })

  test('returns 400 when to is missing', async () => {
    const req = makeRequest('http://localhost/api/v1/krl/route?from=JAKK&time=10:00')
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error?.message).toBe('Parameters "from" and "to" are required')
  })

  test('returns 400 when from equals to', async () => {
    const req = makeRequest('http://localhost/api/v1/krl/route?from=JAKK&to=JAKK&time=10:00')
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error?.message).toBe('Origin and destination must be different stations')
  })

  test('returns 400 for unknown station', async () => {
    const req = makeRequest('http://localhost/api/v1/krl/route?from=XXXXX&to=JAKK&time=10:00')
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error?.message).toBe('Station not recognized for route lookup')
  })

  test('streams SSE events for a successful single-leg route', async () => {
    getScheduleSnapshot.mockImplementation((id: string) => {
      if (id === 'JAKK') return Promise.resolve(
        scheduleSnapshot([createScheduleRow({ train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' })])
      )
      return Promise.resolve(null)
    })
    getRepoScheduleSnapshot.mockResolvedValue(null)
    getTrainSnapshot.mockImplementation((id: string) => {
      if (id === '1151') return Promise.resolve(
        trainSnapshot([
          createTrainRow('JAKK', 'Jakarta Kota', '04:00:00', { color: '#E30A16' }),
          createTrainRow('MRI', 'Manggarai', '04:15:00', { color: '#E30A16' }),
        ])
      )
      return Promise.resolve(null)
    })
    getRepoTrainScheduleSnapshot.mockResolvedValue(null)

    const req = makeRequest('http://localhost/api/v1/krl/route?from=JAKK&to=MRI&time=04:00')
    const response = await GET(req)

    expect(response.headers.get('content-type')).toBe('text/event-stream')

    const text = await response.text()
    const events = parseSSE(text)

    const legEvent = events.find((e) => e.event === 'leg')
    expect(legEvent).toBeDefined()
    expect(legEvent!.data.from).toBe('JAKK')
    expect(legEvent!.data.to).toBe('MRI')
    expect(legEvent!.data.legs).toHaveLength(1)

    const doneEvent = events.find((e) => e.event === 'done')
    expect(doneEvent).toBeDefined()
    expect(doneEvent!.data.legsFound).toBe(1)
    expect(doneEvent!.data.legsFailed).toBe(0)
  })

  test('streams SSE events for a multi-leg transit route', async () => {
    getScheduleSnapshot.mockImplementation((id: string) => {
      if (id === 'PSMB') return Promise.resolve(
        scheduleSnapshot([createScheduleRow({ train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' })])
      )
      if (id === 'MRI') return Promise.resolve(
        scheduleSnapshot([createScheduleRow({ train_id: '1801', ka_name: 'COMMUTER LINE CIKARANG', color: '#0000FF', time_est: '04:45:00' })])
      )
      return Promise.resolve(null)
    })
    getRepoScheduleSnapshot.mockResolvedValue(null)
    getTrainSnapshot.mockImplementation((id: string) => {
      if (id === '1151') return Promise.resolve(
        trainSnapshot([
          createTrainRow('PSMB', 'Pasar Minggu Baru', '04:31:00', { color: '#E30A16' }),
          createTrainRow('MRI', 'Manggarai', '04:41:00', { color: '#E30A16' }),
        ])
      )
      if (id === '1801') return Promise.resolve(
        trainSnapshot([
          createTrainRow('MRI', 'Manggarai', '04:45:00', { color: '#0000FF' }),
          createTrainRow('THB', 'Tanah Abang', '04:58:00', { color: '#0000FF' }),
        ])
      )
      return Promise.resolve(null)
    })
    getRepoTrainScheduleSnapshot.mockResolvedValue(null)

    const req = makeRequest('http://localhost/api/v1/krl/route?from=PSMB&to=THB&time=04:00')
    const response = await GET(req)

    expect(response.headers.get('content-type')).toBe('text/event-stream')

    const text = await response.text()
    const events = parseSSE(text)

    const legEvents = events.filter((e) => e.event === 'leg')
    expect(legEvents).toHaveLength(2)
    expect(legEvents[0].data.from).toBe('PSMB')
    expect(legEvents[0].data.to).toBe('MRI')
    expect(legEvents[1].data.from).toBe('MRI')
    expect(legEvents[1].data.to).toBe('THB')

    const doneEvent = events.find((e) => e.event === 'done')
    expect(doneEvent).toBeDefined()
    expect(doneEvent!.data.legsFound).toBe(2)
    expect(doneEvent!.data.legsFailed).toBe(0)
  })

  test('streams leg-error events on partial failure', async () => {
    getScheduleSnapshot.mockImplementation((id: string) => {
      if (id === 'PSMB') return Promise.resolve(
        scheduleSnapshot([createScheduleRow({ train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' })])
      )
      return Promise.resolve(scheduleSnapshot([]))
    })
    getRepoScheduleSnapshot.mockResolvedValue(null)
    getTrainSnapshot.mockImplementation((id: string) => {
      if (id === '1151') return Promise.resolve(
        trainSnapshot([
          createTrainRow('PSMB', 'Pasar Minggu Baru', '04:31:00', { color: '#E30A16' }),
          createTrainRow('MRI', 'Manggarai', '04:41:00', { color: '#E30A16' }),
        ])
      )
      return Promise.resolve(null)
    })
    getRepoTrainScheduleSnapshot.mockResolvedValue(null)

    const req = makeRequest('http://localhost/api/v1/krl/route?from=PSMB&to=DU&time=04:00')
    const response = await GET(req)

    const text = await response.text()
    const events = parseSSE(text)

    const legEvents = events.filter((e) => e.event === 'leg')
    expect(legEvents).toHaveLength(1)

    const legErrorEvents = events.filter((e) => e.event === 'leg-error')
    expect(legErrorEvents.length).toBeGreaterThan(0)

    const doneEvent = events.find((e) => e.event === 'done')
    expect(doneEvent).toBeDefined()
    expect(doneEvent!.data.legsFound).toBe(1)
    expect(doneEvent!.data.legsFailed).toBeGreaterThan(0)
  })
})
