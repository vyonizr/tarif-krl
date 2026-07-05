/// <reference types="jest" />

import { getStations, getFareAndSchedule } from './adapter'
import { IMRTStation, MrtRouteResponse } from './types'

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
  return { ok, status, json: () => Promise.resolve(data), text: () => Promise.resolve(JSON.stringify(data)) }
}

function createStation(
  id: number,
  slug: string,
  name: string
): IMRTStation {
  return { id, slug, name }
}

function createRouteResponse(
  overrides: Partial<MrtRouteResponse> = {}
): MrtRouteResponse {
  return {
    success: true,
    data: {
      from: {
        id: 4,
        name: 'Stasiun MRT Lebak Bulus',
        object: {
          schedule: {
            start: 'Lebak Bulus',
            end: 'Bundaran HI',
            weekdaysStart: '',
            weekdaysEnd: '05:00:00;05:15:00',
            weekendsStart: '',
            weekendsEnd: '06:00:00',
          },
        },
      },
      to: {
        id: 6,
        name: 'Bundaran HI Bank Jakarta',
        object: {},
      },
      integration: {
        cost: 14000,
        timeEstimation: '30',
      },
    },
    ...overrides,
  }
}

beforeEach(() => {
  jest.restoreAllMocks()
})

describe('getStations', () => {
  test('returns station list from /datum endpoint', async () => {
    const stations = [
      createStation(4, 'stasiun-lebak-bulus', 'Stasiun MRT Lebak Bulus'),
      createStation(5, 'stasiun-asean', 'ASEAN Headquarter'),
      createStation(6, 'bundaran-hi', 'Bundaran HI Bank Jakarta'),
    ]

    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({ data: stations })
    )

    const result = await getStations()

    expect(result).toEqual(stations)
    expect(global.fetch).toHaveBeenCalledTimes(1)

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toContain('/datum')
    expect(url).toContain('fields%5B%5D=id')
    expect(url).toContain('fields%5B%5D=slug')
    expect(url).toContain('fields%5B%5D=name')
    expect(url).toContain('filters%5Bfield%5D%5Bslug%5D=stasiun')
    expect(url).toContain('locale=id')
    expect(options.headers).toHaveProperty('origin', 'https://jakartamrt.co.id')
    expect(options.headers).toHaveProperty(
      'referer',
      'https://jakartamrt.co.id/'
    )
  })

  test('throws on non-2xx response', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(createFetchResponse({}, false, 500))

    await expect(getStations()).rejects.toThrow('Upstream returned HTTP 500')
  })

  test('throws on network error', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('Network error'))

    await expect(getStations()).rejects.toThrow('Network error')
  })
})

describe('getFareAndSchedule', () => {
  test('returns fare, timeEstimation, direction, and schedule', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(createFetchResponse(createRouteResponse()))

    const result = await getFareAndSchedule(4, 6)

    expect(result.fare).toBe(14000)
    expect(result.timeEstimation).toBe(30)
    expect(result.direction).toEqual({
      start: 'Lebak Bulus',
      end: 'Bundaran HI',
    })
    expect(result.schedule.weekdays).toEqual(['05:00:00', '05:15:00'])
    expect(result.schedule.weekends).toEqual(['06:00:00'])
  })

  test('resolves toward-end direction when to is past from in line order', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(createFetchResponse(createRouteResponse()))

    const result = await getFareAndSchedule(4, 36)

    expect(result.direction).toEqual({
      start: 'Lebak Bulus',
      end: 'Bundaran HI',
    })
    expect(result.schedule.weekdays).toEqual(['05:00:00', '05:15:00'])
  })

  test('resolves toward-start direction when to is before from in line order', async () => {
    const response = createRouteResponse()
    response.data.from.id = 36
    response.data.from.name = 'Stasiun MRT Blok M BCA'
    response.data.from.object = {
      schedule: {
        start: 'Lebak Bulus',
        end: 'Bundaran HI',
        weekdaysStart: '05:30:00;05:45:00',
        weekdaysEnd: '06:00:00',
        weekendsStart: '06:30:00',
        weekendsEnd: '07:00:00',
      },
    }

    global.fetch = jest
      .fn()
      .mockResolvedValue(createFetchResponse(response))

    const result = await getFareAndSchedule(36, 4)

    expect(result.schedule.weekdays).toEqual(['05:30:00', '05:45:00'])
    expect(result.schedule.weekends).toEqual(['06:30:00'])
  })

  test('handles terminus with no Start schedule fields', async () => {
    const response = createRouteResponse()
    response.data.from.id = 4
    response.data.from.name = 'Stasiun MRT Lebak Bulus'
    response.data.from.object = {
      schedule: {
        start: 'Lebak Bulus',
        end: 'Bundaran HI',
        weekdaysStart: '',
        weekdaysEnd: '05:00:00;05:15:00',
        weekendsStart: '',
        weekendsEnd: '06:00:00',
      },
    }

    global.fetch = jest
      .fn()
      .mockResolvedValue(createFetchResponse(response))

    const result = await getFareAndSchedule(4, 6)

    expect(result.schedule.weekdays).toEqual(['05:00:00', '05:15:00'])
    expect(result.schedule.weekends).toEqual(['06:00:00'])
  })

  test('handles missing schedule object by using station names', async () => {
    const response = createRouteResponse()
    delete response.data.from.object.schedule
    response.data.from.name = 'Stasiun MRT Lebak Bulus'
    response.data.to.name = 'Bundaran HI Bank Jakarta'

    global.fetch = jest
      .fn()
      .mockResolvedValue(createFetchResponse(response))

    const result = await getFareAndSchedule(4, 6)

    expect(result.direction).toEqual({
      start: 'Stasiun MRT Lebak Bulus',
      end: 'Bundaran HI Bank Jakarta',
    })
    expect(result.schedule.weekdays).toEqual([])
    expect(result.schedule.weekends).toEqual([])
  })

  test('throws on non-2xx response', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(createFetchResponse({}, false, 500))

    await expect(getFareAndSchedule(4, 6)).rejects.toThrow(
      'Upstream returned HTTP 500'
    )
  })

  test('throws on success: false body', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        createFetchResponse({ success: false, data: null })
      )

    await expect(getFareAndSchedule(4, 6)).rejects.toThrow(
      'Upstream route request was not successful'
    )
  })

  test('throws on network error', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('Network error'))

    await expect(getFareAndSchedule(4, 6)).rejects.toThrow(
      'Network error'
    )
  })

  test('sends origin and referer headers on fare request', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(createFetchResponse(createRouteResponse()))

    await getFareAndSchedule(4, 6)

    const [, options] = (global.fetch as jest.Mock).mock.calls[0]
    expect(options.headers).toHaveProperty(
      'origin',
      'https://jakartamrt.co.id'
    )
    expect(options.headers).toHaveProperty(
      'referer',
      'https://jakartamrt.co.id/'
    )
  })

  test('sends POST with JSON body containing from, to, datetime', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(createFetchResponse(createRouteResponse()))

    await getFareAndSchedule(4, 6, '2025-01-01T12:00:00')

    const [, options] = (global.fetch as jest.Mock).mock.calls[0]
    expect(options.method).toBe('POST')
    expect(options.headers).toHaveProperty(
      'Content-Type',
      'application/json'
    )
    const body = JSON.parse(options.body)
    expect(body).toEqual({
      type: 'from',
      from: '4',
      to: '6',
      datetime: '2025-01-01T12:00:00',
    })
  })

  test('uses current datetime when no datetime provided', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(createFetchResponse(createRouteResponse()))

    await getFareAndSchedule(4, 6)

    const [, options] = (global.fetch as jest.Mock).mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.datetime).toBeTruthy()
    expect(body.datetime).not.toBe('')
  })

  test('throws when from station is not in MRT_LINE_ORDER', async () => {
    await expect(getFareAndSchedule(999, 6)).rejects.toThrow(
      'Station not found in MRT_LINE_ORDER'
    )
  })

  test('throws when to station is not in MRT_LINE_ORDER', async () => {
    await expect(getFareAndSchedule(4, 999)).rejects.toThrow(
      'Station not found in MRT_LINE_ORDER'
    )
  })
})
