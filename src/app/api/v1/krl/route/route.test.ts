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
  staleCache.clear()
})

describe('GET /api/v1/krl/route (SSE)', () => {
  test('returns 400 when from is missing', async () => {
    const req = makeRequest(
      'http://localhost/api/v1/krl/route?to=JAKK&time=10:00'
    )
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error?.message).toBe(
      'Parameters "from" and "to" are required'
    )
  })

  test('returns 400 when to is missing', async () => {
    const req = makeRequest(
      'http://localhost/api/v1/krl/route?from=JAKK&time=10:00'
    )
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error?.message).toBe(
      'Parameters "from" and "to" are required'
    )
  })

  test('returns 400 when from equals to', async () => {
    const req = makeRequest(
      'http://localhost/api/v1/krl/route?from=JAKK&to=JAKK&time=10:00'
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
      'http://localhost/api/v1/krl/route?from=XXXXX&to=JAKK&time=10:00'
    )
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error?.message).toBe(
      'Station not recognized for route lookup'
    )
  })

  test('streams SSE events for a successful single-leg route', async () => {
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
      'http://localhost/api/v1/krl/route?from=JAKK&to=MRI&time=04:00'
    )
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
    let scheduleCallCount = 0
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/schedules')) {
        scheduleCallCount++
        if (url.includes('stationid=PSMB')) {
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
        if (url.includes('stationid=MRI')) {
          return Promise.resolve(
            createFetchResponse({
              status: 200,
              data: [
                createScheduleRow({
                  train_id: '1801',
                  ka_name: 'COMMUTER LINE CIKARANG',
                  color: '#0000FF',
                  time_est: '04:45:00',
                }),
              ],
            })
          )
        }
        return Promise.resolve(
          createFetchResponse({ status: 200, data: [] })
        )
      }
      if (url.includes('/train-schedule')) {
        const urlObj = new URL(url)
        const trainid = urlObj.searchParams.get('trainid')
        if (trainid === '1151') {
          return Promise.resolve(
            createFetchResponse({
              status: 200,
              data: [
                createTrainScheduleRow(
                  'PSMB',
                  'Pasar Minggu Baru',
                  '04:31:00',
                  { color: '#E30A16' }
                ),
                createTrainScheduleRow('MRI', 'Manggarai', '04:41:00', {
                  color: '#E30A16',
                }),
              ],
            })
          )
        }
        if (trainid === '1801') {
          return Promise.resolve(
            createFetchResponse({
              status: 200,
              data: [
                createTrainScheduleRow('MRI', 'Manggarai', '04:45:00', {
                  color: '#0000FF',
                }),
                createTrainScheduleRow('THB', 'Tanah Abang', '04:58:00', {
                  color: '#0000FF',
                }),
              ],
            })
          )
        }
      }
      return Promise.reject(new Error('Unexpected URL'))
    })

    const req = makeRequest(
      'http://localhost/api/v1/krl/route?from=PSMB&to=THB&time=04:00'
    )
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
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/schedules')) {
        if (url.includes('stationid=PSMB')) {
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
        return Promise.resolve(
          createFetchResponse({ status: 200, data: [] })
        )
      }
      if (url.includes('/train-schedule')) {
        return Promise.resolve(
          createFetchResponse({
            status: 200,
            data: [
              createTrainScheduleRow('PSMB', 'Pasar Minggu Baru', '04:31:00', {
                color: '#E30A16',
              }),
              createTrainScheduleRow('MRI', 'Manggarai', '04:41:00', {
                color: '#E30A16',
              }),
            ],
          })
        )
      }
      return Promise.reject(new Error('Unexpected URL'))
    })

    const req = makeRequest(
      'http://localhost/api/v1/krl/route?from=PSMB&to=DU&time=04:00'
    )
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
