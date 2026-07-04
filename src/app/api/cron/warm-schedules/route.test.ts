import { GET } from './route'
import { getSchedules } from '@/lib/krl/adapter'
import { getScheduleSnapshot, setScheduleSnapshot } from '@/lib/krl/snapshotStore'
import { TERMINUS_STATIONS } from '@/lib/krl/constants'

jest.mock('../../../../lib/krl/adapter', () => ({
  getSchedules: jest.fn(),
}))
jest.mock('../../../../lib/krl/snapshotStore', () => ({
  getScheduleSnapshot: jest.fn(),
  setScheduleSnapshot: jest.fn(),
}))

const mockedGetSchedules = getSchedules as jest.Mock
const mockedGetSnapshot = getScheduleSnapshot as jest.Mock
const mockedSetSnapshot = setScheduleSnapshot as jest.Mock

function makeRequest(authHeader?: string): Request {
  return new Request('http://localhost/api/cron/warm-schedules', {
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  delete process.env.CRON_SECRET
  mockedGetSnapshot.mockResolvedValue(null)
  mockedSetSnapshot.mockResolvedValue(undefined)
})

describe('GET /api/cron/warm-schedules', () => {
  test('rejects requests missing the cron secret when one is configured', async () => {
    process.env.CRON_SECRET = 'topsecret'

    const response = await GET(makeRequest())

    expect(response.status).toBe(401)
    expect(mockedGetSchedules).not.toHaveBeenCalled()
  })

  test('accepts requests with a matching cron secret', async () => {
    process.env.CRON_SECRET = 'topsecret'
    mockedGetSchedules.mockResolvedValue([])

    const response = await GET(makeRequest('Bearer topsecret'))

    expect(response.status).toBe(200)
  })

  test('warms every terminus station and overwrites its snapshot unconditionally', async () => {
    mockedGetSchedules.mockResolvedValue([{ train_id: '1' }])

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(mockedGetSchedules).toHaveBeenCalledTimes(TERMINUS_STATIONS.length)
    expect(mockedSetSnapshot).toHaveBeenCalledTimes(TERMINUS_STATIONS.length)
    for (const station of TERMINUS_STATIONS) {
      expect(body.results[station]).toBe('ok')
    }
  })

  test('isolates a single station failure — other stations still warm, failed one keeps its old snapshot', async () => {
    mockedGetSchedules.mockImplementation((stationId: string) => {
      if (stationId === 'JAKK') return Promise.reject(new Error('upstream down'))
      return Promise.resolve([{ train_id: '1' }])
    })

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.results.JAKK).toBe('failed: upstream down')
    expect(mockedSetSnapshot).not.toHaveBeenCalledWith('JAKK', expect.anything())
    // every other station still succeeded and was written
    const otherStations = TERMINUS_STATIONS.filter((s) => s !== 'JAKK')
    for (const station of otherStations) {
      expect(body.results[station]).toBe('ok')
    }
    expect(mockedSetSnapshot).toHaveBeenCalledTimes(otherStations.length)
  })

  test('logs a warning when the warmed schedule differs in size from the previous snapshot', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    mockedGetSnapshot.mockImplementation((stationId: string) =>
      stationId === 'JAKK'
        ? Promise.resolve({ data: [{ train_id: '1' }], capturedAt: '2026-01-01T00:00:00.000Z' })
        : Promise.resolve(null)
    )
    mockedGetSchedules.mockResolvedValue([{ train_id: '1' }, { train_id: '2' }])

    await GET(makeRequest())

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('JAKK'))
    warnSpy.mockRestore()
  })
})
