/// <reference types="jest" />

import { getStations, getFare, getSchedules, getRoute, getTransitRoute, staleCache, breakers } from './adapter'
import { UpstreamError, NoRouteFoundError, KciStationRow, FetchMeta } from './types'
import { getLineGraph, getForkPoint } from './topology'
import { BREAKER_FAILURE_THRESHOLD } from './constants'

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
  breakers.clear()
})

describe('getStations', () => {
  test('groups stations by region header markers', async () => {
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
          createRegionHeader('AREA MERAK'),
          createStationRow({ sta_id: 'MR', sta_name: 'MERAK' }),
          createRegionHeader('SERANG'),
          createStationRow({ sta_id: 'KRA', sta_name: 'KARANGANTU' }),
        ],
      })
    )

    const result = await getStations()

    expect(result).toEqual({
      Jabodetabek: [
        { id: 'AC', name: 'Ancol' },
        { id: 'BPR', name: 'Bogor Paledang' },
      ],
      Yogyakarta: [
        { id: 'YK', name: 'Yogyakarta' },
      ],
      Merak: [
        { id: 'MR', name: 'Merak' },
      ],
      Serang: [
        { id: 'KRA', name: 'Karangantu' },
      ],
    })
  })

  test('excludes fg_enable 0 rows from station lists', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        status: 200,
        data: [
          createRegionHeader('AREA JABODETABEK'),
          createStationRow({ sta_id: 'AC', sta_name: 'ANCOL' }),
          createRegionHeader('AREA YOGYAKARTA'),
          createStationRow({ sta_id: 'YK', sta_name: 'YOGYAKARTA' }),
        ],
      })
    )

    const result = await getStations()

    const allStationIds = Object.values(result).flat().map((s) => s.id)
    expect(allStationIds).not.toContain('WIL0')
  })

  test('sorts stations alphabetically within each region', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        status: 200,
        data: [
          createRegionHeader('AREA JABODETABEK'),
          createStationRow({ sta_id: 'B', sta_name: 'BOGOR' }),
          createStationRow({ sta_id: 'A', sta_name: 'ANCOL' }),
          createStationRow({ sta_id: 'C', sta_name: 'CAKUNG' }),
        ],
      })
    )

    const result = await getStations()

    expect(result.Jabodetabek.map((s) => s.id)).toEqual(['A', 'B', 'C'])
  })

  test('ignores stations before any region header', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        status: 200,
        data: [
          createStationRow({ sta_id: 'ORPHAN', sta_name: 'ORPHAN STATION' }),
          createRegionHeader('AREA JABODETABEK'),
          createStationRow({ sta_id: 'AC', sta_name: 'ANCOL' }),
        ],
      })
    )

    const result = await getStations()

    expect(result.Jabodetabek).toHaveLength(1)
    expect(result.Jabodetabek[0].id).toBe('AC')
  })

  test('strips AREA prefix from region headers', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        status: 200,
        data: [
          createRegionHeader('AREA JABODETABEK'),
          createStationRow({ sta_id: 'AC', sta_name: 'ANCOL' }),
        ],
      })
    )

    const result = await getStations()

    expect(Object.keys(result)).toContain('Jabodetabek')
    expect(Object.keys(result)).not.toContain('AREA Jabodetabek')
  })

  test('throws UpstreamError on non-200 response without retry', async () => {
    let callCount = 0
    global.fetch = jest.fn().mockImplementation(() => {
      callCount++
      return Promise.resolve(createFetchResponse({}, false, 404))
    })

    const result = getStations()
    await expect(result).rejects.toThrow(UpstreamError)
    await expect(result).rejects.toMatchObject({
      status: 502,
      message: 'Upstream returned HTTP 404',
    })
    expect(callCount).toBe(1)
  })

  test('retries once on network error then succeeds', async () => {
    let callCount = 0
    global.fetch = jest.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.reject(new Error('Network error'))
      }
      return Promise.resolve(
        createFetchResponse({
          status: 200,
          data: [
            createRegionHeader('AREA JABODETABEK'),
            createStationRow({ sta_id: 'AC', sta_name: 'ANCOL' }),
          ],
        })
      )
    })

    const result = await getStations()

    expect(callCount).toBe(2)
    expect(result.Jabodetabek).toHaveLength(1)
  })

  test('throws UpstreamError after exhausting retries', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('Network error'))

    const result = getStations()
    await expect(result).rejects.toThrow(UpstreamError)
    await expect(result).rejects.toMatchObject({
      status: 502,
      message: 'Upstream KRL API unavailable',
    })
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})

describe('getFare', () => {
  test('maps upstream fare response to public shape', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        status: 200,
        data: [
          {
            sta_code_from: 'AC',
            sta_name_from: 'ANCOL',
            sta_code_to: 'BPR',
            sta_name_to: 'BOGOR PALEDANG',
            fare: 3000,
            distance: '23.205',
          },
        ],
      })
    )

    const result = await getFare('AC', 'BPR')

    expect(result).toEqual([
      { from: 'AC', to: 'BPR', fare: 3000, distance: '23.205' },
    ])
  })

  test('retries once on network error', async () => {
    let callCount = 0
    global.fetch = jest.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.reject(new Error('Network error'))
      }
      return Promise.resolve(
        createFetchResponse({
          status: 200,
          data: [
            {
              sta_code_from: 'AC',
              sta_name_from: 'ANCOL',
              sta_code_to: 'BPR',
              sta_name_to: 'BOGOR PALEDANG',
              fare: 3000,
              distance: '23.205',
            },
          ],
        })
      )
    })

    const result = await getFare('AC', 'BPR')

    expect(callCount).toBe(2)
    expect(result[0].fare).toBe(3000)
  })

  test('throws UpstreamError on non-200 response', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({}, false, 404)
    )

    await expect(getFare('AC', 'BPR')).rejects.toMatchObject({
      status: 502,
      message: 'Upstream returned HTTP 404',
    })
  })
})

describe('getSchedules', () => {
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
          {
            train_id: '3',
            ka_name: 'COMMUTER LINE CIKARANG',
            route_name: 'CIKARANG - JAKARTA',
            dest: 'CIKARANG',
            time_est: '10:10:00',
            color: '#003399',
            dest_time: '10:40:00',
          },
        ],
      })
    )

    const result = await getSchedules('STA1', '10:00')

    expect(result).toHaveLength(2)
    expect(result.map((s) => s.train_id)).toEqual(['1', '3'])
  })

  test('retries once on network error', async () => {
    let callCount = 0
    global.fetch = jest.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.reject(new Error('Network error'))
      }
      return Promise.resolve(
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
    })

    const result = await getSchedules('STA1', '10:00')

    expect(callCount).toBe(2)
    expect(result).toHaveLength(1)
  })

  test('always fetches the full day (coarse cache key) regardless of requested window', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        status: 200,
        data: [],
      })
    )

    await getSchedules('STA1', '10:00', '22:00')

    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toContain('timefrom=00%3A00')
    expect(url).toContain('timeto=23%3A59')
  })

  test('filters results to the requested window after the coarse fetch', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        status: 200,
        data: [
          {
            train_id: '1',
            ka_name: 'COMMUTER LINE BOGOR',
            route_name: 'BOGOR - JAKARTA',
            dest: 'BOGOR',
            time_est: '09:00:00',
            color: '#E30A16',
            dest_time: '09:30:00',
          },
          {
            train_id: '2',
            ka_name: 'COMMUTER LINE BOGOR',
            route_name: 'BOGOR - JAKARTA',
            dest: 'BOGOR',
            time_est: '10:30:00',
            color: '#E30A16',
            dest_time: '11:00:00',
          },
          {
            train_id: '3',
            ka_name: 'COMMUTER LINE BOGOR',
            route_name: 'BOGOR - JAKARTA',
            dest: 'BOGOR',
            time_est: '22:30:00',
            color: '#E30A16',
            dest_time: '23:00:00',
          },
        ],
      })
    )

    const result = await getSchedules('STA1', '10:00', '22:00')

    expect(result.map((s) => s.train_id)).toEqual(['2'])
  })
})

describe('getRoute', () => {
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
    overrides: Partial<{
      color: string
      transit_station: boolean
    }> = {}
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

  function fetchMock(url: string) {
    if (url.includes('/schedules')) {
      return Promise.resolve(
        createFetchResponse({
          status: 200,
          data: schedulesResponse,
        })
      )
    }
    if (url.includes('/train-schedule')) {
      const trainId = new URL(url).searchParams.get('trainid')
      const data = trainSchedules[trainId!] ?? []
      return Promise.resolve(
        createFetchResponse({ status: 200, data })
      )
    }
    return Promise.reject(new Error('Unexpected URL'))
  }

  let schedulesResponse: ReturnType<typeof createScheduleRow>[]
  let trainSchedules: Record<string, ReturnType<typeof createTrainScheduleRow>[]>

  beforeEach(() => {
    jest.restoreAllMocks()
    schedulesResponse = []
    trainSchedules = {}
    global.fetch = jest.fn().mockImplementation((url: string) => fetchMock(url))
  })

  test('returns sliced stop list when first candidate covers both stations', async () => {
    schedulesResponse = [
      createScheduleRow({ train_id: '1151' }),
    ]
    trainSchedules = {
      '1151': [
        createTrainScheduleRow('PSMB', 'Pasar Minggu Baru', '04:31:00'),
        createTrainScheduleRow('DRN', 'Duren Kalibata', '04:32:00'),
        createTrainScheduleRow('CW', 'Cawang', '04:34:00'),
        createTrainScheduleRow('JAKK', 'Jakarta Kota', '05:03:00'),
      ],
    }

    const result = await getRoute('PSMB', 'CW', '04:00')

    expect(result).toEqual({
      train_id: '1151',
      train_name: 'COMMUTER LINE BOGOR',
      color: '#E30A16',
      stops: [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:31' },
        { station_id: 'DRN', station_name: 'Duren Kalibata', time_est: '04:32' },
        { station_id: 'CW', station_name: 'Cawang', time_est: '04:34' },
      ],
    })
  })

  test('skips candidate that does not include destination', async () => {
    schedulesResponse = [
      createScheduleRow({ train_id: '1151' }),
      createScheduleRow({ train_id: '1152', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' }),
    ]
    trainSchedules = {
      '1151': [
        createTrainScheduleRow('PSMB', 'Pasar Minggu Baru', '04:31:00'),
        createTrainScheduleRow('DRN', 'Duren Kalibata', '04:32:00'),
      ],
      '1152': [
        createTrainScheduleRow('PSMB', 'Pasar Minggu Baru', '04:35:00', { color: '#E30A16' }),
        createTrainScheduleRow('CW', 'Cawang', '04:37:00', { color: '#E30A16' }),
        createTrainScheduleRow('JAKK', 'Jakarta Kota', '05:03:00', { color: '#E30A16' }),
      ],
    }

    const result = await getRoute('PSMB', 'JAKK', '04:00')

    expect(result).toEqual({
      train_id: '1152',
      train_name: 'COMMUTER LINE BOGOR',
      color: '#E30A16',
      stops: [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:35' },
        { station_id: 'CW', station_name: 'Cawang', time_est: '04:37' },
        { station_id: 'JAKK', station_name: 'Jakarta Kota', time_est: '05:03' },
      ],
    })
  })

  test('skips candidate where destination appears before origin', async () => {
    schedulesResponse = [
      createScheduleRow({ train_id: '1151' }),
      createScheduleRow({ train_id: '1152', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' }),
    ]
    trainSchedules = {
      '1151': [
        createTrainScheduleRow('CW', 'Cawang', '04:00:00'),
        createTrainScheduleRow('PSMB', 'Pasar Minggu Baru', '04:02:00'),
      ],
      '1152': [
        createTrainScheduleRow('PSMB', 'Pasar Minggu Baru', '04:35:00', { color: '#E30A16' }),
        createTrainScheduleRow('CW', 'Cawang', '04:37:00', { color: '#E30A16' }),
      ],
    }

    const result = await getRoute('PSMB', 'CW', '04:00')

    expect(result).toEqual({
      train_id: '1152',
      train_name: 'COMMUTER LINE BOGOR',
      color: '#E30A16',
      stops: [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:35' },
        { station_id: 'CW', station_name: 'Cawang', time_est: '04:37' },
      ],
    })
  })

  test('throws NoRouteFoundError when no candidate matches', async () => {
    schedulesResponse = [
      createScheduleRow({ train_id: '1151' }),
      createScheduleRow({ train_id: '1152' }),
    ]
    trainSchedules = {
      '1151': [
        createTrainScheduleRow('PSMB', 'Pasar Minggu Baru', '04:31:00'),
        createTrainScheduleRow('DRN', 'Duren Kalibata', '04:32:00'),
      ],
      '1152': [
        createTrainScheduleRow('CW', 'Cawang', '04:35:00'),
        createTrainScheduleRow('JAKK', 'Jakarta Kota', '05:03:00'),
      ],
    }

    await expect(getRoute('PSMB', 'JAKK', '04:00')).rejects.toThrow(
      NoRouteFoundError
    )
    await expect(getRoute('PSMB', 'JAKK', '04:00')).rejects.toMatchObject({
      message: 'No direct route found between the given stations',
    })
  })

  test('computes timeTo from timeFrom using ROUTE_SEARCH_WINDOW_HOURS to filter candidates', async () => {
    schedulesResponse = [
      createScheduleRow({ train_id: '1151', time_est: '10:05:00' }),
      createScheduleRow({ train_id: '1152', time_est: '13:05:00' }),
    ]
    trainSchedules = {
      '1151': [
        createTrainScheduleRow('PSMB', 'Pasar Minggu Baru', '10:31:00'),
        createTrainScheduleRow('CW', 'Cawang', '10:34:00'),
      ],
      '1152': [
        createTrainScheduleRow('PSMB', 'Pasar Minggu Baru', '13:31:00'),
        createTrainScheduleRow('CW', 'Cawang', '13:34:00'),
      ],
    }

    const result = await getRoute('PSMB', 'CW', '10:00')

    // 13:05 departure is outside the 3-hour window from 10:00 (cutoff 13:00),
    // so only the 1151 candidate should have been considered.
    expect(result.train_id).toBe('1151')
  })

  test('picks second occurrence of duplicate station (Manggarai → Jatinegara)', async () => {
    schedulesResponse = [
      createScheduleRow({
        train_id: '1801',
        ka_name: 'COMMUTER LINE CIKARANG',
        color: '#003399',
      }),
    ]
    trainSchedules = {
      '1801': [
        createTrainScheduleRow('CKR', 'CIKARANG', '04:00:00', { color: '#003399' }),
        createTrainScheduleRow('JNG', 'JATINEGARA', '04:15:00', { color: '#003399' }),
        createTrainScheduleRow('MTR', 'MATRAMAN', '04:25:00', { color: '#003399' }),
        createTrainScheduleRow('MRI', 'Manggarai', '04:35:00', { color: '#003399' }),
        createTrainScheduleRow('SUD', 'SUDIRMAN', '04:42:00', { color: '#003399' }),
        createTrainScheduleRow('JNG', 'JATINEGARA', '05:10:00', { color: '#003399' }),
        createTrainScheduleRow('CKR', 'CIKARANG', '05:45:00', { color: '#003399' }),
      ],
    }

    const result = await getRoute('MRI', 'JNG', '04:00')

    expect(result.stops.map((s) => s.station_id)).toEqual([
      'MRI', 'SUD', 'JNG',
    ])
    expect(result.stops[2].time_est).toBe('05:10')
  })

  test('picks train closest to departure time when multiple candidates match', async () => {
    schedulesResponse = [
      createScheduleRow({ train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' }),
      createScheduleRow({ train_id: '1152', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' }),
      createScheduleRow({ train_id: '1153', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' }),
    ]
    trainSchedules = {
      '1151': [
        createTrainScheduleRow('PSMB', 'Pasar Minggu Baru', '04:31:00', { color: '#E30A16' }),
        createTrainScheduleRow('CW', 'Cawang', '04:34:00', { color: '#E30A16' }),
      ],
      '1152': [
        createTrainScheduleRow('PSMB', 'Pasar Minggu Baru', '04:02:00', { color: '#E30A16' }),
        createTrainScheduleRow('CW', 'Cawang', '04:05:00', { color: '#E30A16' }),
      ],
      '1153': [
        createTrainScheduleRow('PSMB', 'Pasar Minggu Baru', '04:05:00', { color: '#E30A16' }),
        createTrainScheduleRow('CW', 'Cawang', '04:08:00', { color: '#E30A16' }),
      ],
    }

    const result = await getRoute('PSMB', 'CW', '04:00')

    expect(result.train_id).toBe('1152')
    expect(result.stops[0].time_est).toBe('04:02')
  })

  test('pre-filter skips candidates on different lines', async () => {
    schedulesResponse = [
      createScheduleRow({ train_id: '1151', ka_name: 'COMMUTER LINE CIKARANG', color: '#003399' }),
      createScheduleRow({ train_id: '1152', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' }),
    ]
    trainSchedules = {
      '1151': [
        createTrainScheduleRow('PSMB', 'Pasar Minggu Baru', '04:31:00', { color: '#003399' }),
        createTrainScheduleRow('CW', 'Cawang', '04:33:00', { color: '#003399' }),
      ],
      '1152': [
        createTrainScheduleRow('PSMB', 'Pasar Minggu Baru', '04:35:00', { color: '#E30A16' }),
        createTrainScheduleRow('CW', 'Cawang', '04:37:00', { color: '#E30A16' }),
      ],
    }

    const result = await getRoute('PSMB', 'CW', '04:00')

    expect(result.train_id).toBe('1152')
  })
})

describe('circuit breaker', () => {
  test('opens after BREAKER_FAILURE_THRESHOLD exhausted-retry failures and skips the network call', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    for (let i = 0; i < BREAKER_FAILURE_THRESHOLD; i++) {
      await expect(getStations()).rejects.toThrow(UpstreamError)
    }
    // BREAKER_FAILURE_THRESHOLD calls * 2 attempts each (1 retry), breaker now open
    expect(global.fetch).toHaveBeenCalledTimes(BREAKER_FAILURE_THRESHOLD * 2)

    await expect(getStations()).rejects.toThrow(UpstreamError)
    // breaker open — no additional network attempt made
    expect(global.fetch).toHaveBeenCalledTimes(BREAKER_FAILURE_THRESHOLD * 2)
  })

  test('serves stale cache on failure even once the breaker is open, without hitting the network', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(
      createFetchResponse({
        status: 200,
        data: [
          createRegionHeader('AREA JABODETABEK'),
          createStationRow({ sta_id: 'AC', sta_name: 'ANCOL' }),
        ],
      })
    )
    await getStations()

    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))
    // BREAKER_FAILURE_THRESHOLD failures opens the breaker; stale cache still resolves each time.
    for (let i = 0; i < BREAKER_FAILURE_THRESHOLD + 1; i++) {
      const result = await getStations()
      expect(result.Jabodetabek).toHaveLength(1)
    }

    // Once open, the breaker skips the network call entirely (2 attempts
    // per call for the failing calls up to the threshold, then 0 more).
    expect(global.fetch).toHaveBeenCalledTimes(BREAKER_FAILURE_THRESHOLD * 2)
  })
})

describe('request coalescing', () => {
  test('concurrent calls for the same resource share a single upstream fetch', async () => {
    let callCount = 0
    global.fetch = jest.fn().mockImplementation(() => {
      callCount++
      return new Promise((resolve) =>
        setTimeout(
          () =>
            resolve(
              createFetchResponse({
                status: 200,
                data: [
                  createRegionHeader('AREA JABODETABEK'),
                  createStationRow({ sta_id: 'AC', sta_name: 'ANCOL' }),
                ],
              })
            ),
          10
        )
      )
    })

    const [a, b] = await Promise.all([getStations(), getStations()])

    expect(callCount).toBe(1)
    expect(a).toEqual(b)
  })
})

describe('data source tracking (FetchMeta)', () => {
  test('marks meta as live on a healthy fetch', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        status: 200,
        data: [
          createRegionHeader('AREA JABODETABEK'),
          createStationRow({ sta_id: 'AC', sta_name: 'ANCOL' }),
        ],
      })
    )

    const meta: FetchMeta = { source: 'live' }
    await getStations(meta)

    expect(meta.source).toBe('live')
  })

  test('marks meta as stale-cache when serving from the fallback', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(
      createFetchResponse({
        status: 200,
        data: [
          createRegionHeader('AREA JABODETABEK'),
          createStationRow({ sta_id: 'AC', sta_name: 'ANCOL' }),
        ],
      })
    )
    await getStations()

    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))
    const meta: FetchMeta = { source: 'live' }
    await getStations(meta)

    expect(meta.source).toBe('stale-cache')
    expect(meta.capturedAt).toBeDefined()
  })
})

describe('line graph', () => {
  test('produces expected transfer edges', () => {
    const graph = getLineGraph()

    expect(graph.edges.get('red')?.get('blue')).toBe('MRI')
    expect(graph.edges.get('blue')?.get('red')).toBe('MRI')
    expect(graph.edges.get('blue')?.get('green')).toBe('THB')
    expect(graph.edges.get('green')?.get('blue')).toBe('THB')
    expect(graph.edges.get('blue')?.get('brown')).toBe('DU')
    expect(graph.edges.get('brown')?.get('blue')).toBe('DU')
    expect(graph.edges.get('pink')?.get('blue')).toBe('KPB')
    expect(graph.edges.get('blue')?.get('pink')).toBe('KPB')
    expect(graph.edges.get('pink')?.get('red')).toBe('JAKK')
    expect(graph.edges.get('red')?.get('pink')).toBe('JAKK')
    expect(graph.edges.get('green')?.get('merak')).toBe('RK')
    expect(graph.edges.get('merak')?.get('green')).toBe('RK')
  })

  test('does not create edge for same-line station appearing twice (Jatinegara)', () => {
    const graph = getLineGraph()

    const jngLines = graph.stations.get('JNG')
    expect(jngLines).toEqual(['blue'])
  })

  test('red line fork point resolves Bogor ↔ Nambo cross-branch', () => {
    expect(getForkPoint('BOO', 'NMO')).toBe('CTA')
    expect(getForkPoint('NMO', 'BOO')).toBe('CTA')
  })

  test('fork point is null for same-branch or trunk-to-branch pairs', () => {
    expect(getForkPoint('BJD', 'BOO')).toBeNull()
    expect(getForkPoint('DP', 'BOO')).toBeNull()
    expect(getForkPoint('CTA', 'BOO')).toBeNull()
  })

  test('fork point is null for stations on different lines', () => {
    expect(getForkPoint('BOO', 'MRI')).toBeNull()
    expect(getForkPoint('THB', 'NMO')).toBeNull()
  })
})

describe('getTransitRoute', () => {
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

  function createVirtualTrainRow(
    train_id: string,
    ka_name: string,
    color: string,
    stops: Array<{ station_id: string; station_name: string; time_est: string }>
  ) {
    return stops.map((s) => ({
      train_id,
      ka_name,
      station_id: s.station_id,
      station_name: s.station_name,
      time_est: s.time_est,
      transit: '',
      color,
      transit_station: false,
    }))
  }

  let schedulesByStation: Record<
    string,
    ReturnType<typeof createScheduleRow>[]
  >
  let trainSchedules: Record<
    string,
    ReturnType<typeof createTrainScheduleRow>[]
  >

  beforeEach(() => {
    jest.restoreAllMocks()
    schedulesByStation = {}
    trainSchedules = {}

    global.fetch = jest
      .fn()
      .mockImplementation((url: string) => {
        const urlObj = new URL(url)

        if (url.includes('/schedules')) {
          const stationid = urlObj.searchParams.get('stationid') ?? ''
          const data = schedulesByStation[stationid] ?? []
          return Promise.resolve(createFetchResponse({ status: 200, data }))
        }

        if (url.includes('/train-schedule')) {
          const trainid = urlObj.searchParams.get('trainid') ?? ''
          const data = trainSchedules[trainid] ?? []
          return Promise.resolve(createFetchResponse({ status: 200, data }))
        }

        return Promise.reject(new Error('Unexpected URL'))
      })
  })

  test('delegates to single-leg getRoute when stations share a line', async () => {
    schedulesByStation = {
      CW: [
        createScheduleRow({
          train_id: '1151',
          ka_name: 'COMMUTER LINE BOGOR',
          color: '#E30A16',
        }),
      ],
    }
    trainSchedules = {
      '1151': createVirtualTrainRow('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'CW', station_name: 'Cawang', time_est: '04:34:00' },
        { station_id: 'JAKK', station_name: 'Jakarta Kota', time_est: '05:03:00' },
      ]),
    }

    const legs = await getTransitRoute('CW', 'JAKK', '04:00')

    expect(legs).toHaveLength(1)
    expect(legs[0]).toEqual({
      train_id: '1151',
      train_name: 'COMMUTER LINE BOGOR',
      color: '#E30A16',
      stops: [
        { station_id: 'CW', station_name: 'Cawang', time_est: '04:34' },
        { station_id: 'JAKK', station_name: 'Jakarta Kota', time_est: '05:03' },
      ],
    })
  })

  test('chains legs across two lines with one transfer', async () => {
    schedulesByStation = {
      PSMB: [
        createScheduleRow({
          train_id: '1151',
          ka_name: 'COMMUTER LINE BOGOR',
          color: '#E30A16',
        }),
      ],
      MRI: [
        createScheduleRow({
          train_id: '1801',
          ka_name: 'COMMUTER LINE CIKARANG',
          color: '#0000FF',
          time_est: '04:45:00',
        }),
      ],
    }
    trainSchedules = {
      '1151': createVirtualTrainRow('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:31:00' },
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:41:00' },
      ]),
      '1801': createVirtualTrainRow('1801', 'COMMUTER LINE CIKARANG', '#0000FF', [
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:45:00' },
        { station_id: 'THB', station_name: 'Tanah Abang', time_est: '04:58:00' },
      ]),
    }

    const legs = await getTransitRoute('PSMB', 'THB', '04:00')

    expect(legs).toHaveLength(2)
    expect(legs[0]).toEqual({
      train_id: '1151',
      train_name: 'COMMUTER LINE BOGOR',
      color: '#E30A16',
      stops: [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:31' },
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:41' },
      ],
    })
    expect(legs[1]).toEqual({
      train_id: '1801',
      train_name: 'COMMUTER LINE CIKARANG',
      color: '#0000FF',
      stops: [
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:45' },
        { station_id: 'THB', station_name: 'Tanah Abang', time_est: '04:58' },
      ],
    })
  })

  test('chains three legs with two transfers (PSMB → RU)', async () => {
    schedulesByStation = {
      PSMB: [
        createScheduleRow({
          train_id: '1151',
          ka_name: 'COMMUTER LINE BOGOR',
          color: '#E30A16',
        }),
      ],
      MRI: [
        createScheduleRow({
          train_id: '1801',
          ka_name: 'COMMUTER LINE CIKARANG',
          color: '#0000FF',
          time_est: '04:45:00',
        }),
      ],
      THB: [
        createScheduleRow({
          train_id: '217',
          ka_name: 'COMMUTER LINE RANGKASBITUNG',
          color: '#00A651',
          time_est: '05:03:00',
        }),
      ],
    }
    trainSchedules = {
      '1151': createVirtualTrainRow('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:31:00' },
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:41:00' },
      ]),
      '1801': createVirtualTrainRow('1801', 'COMMUTER LINE CIKARANG', '#0000FF', [
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:45:00' },
        { station_id: 'THB', station_name: 'Tanah Abang', time_est: '04:58:00' },
      ]),
      '217': createVirtualTrainRow('217', 'COMMUTER LINE RANGKASBITUNG', '#00A651', [
        { station_id: 'THB', station_name: 'Tanah Abang', time_est: '05:03:00' },
        { station_id: 'RU', station_name: 'Rawa Buntu', time_est: '05:25:00' },
      ]),
    }

    const legs = await getTransitRoute('PSMB', 'RU', '04:00')

    expect(legs).toHaveLength(3)
    expect(legs[0].train_id).toBe('1151')
    expect(legs[1].train_id).toBe('1801')
    expect(legs[2].train_id).toBe('217')
  })

  test('throws NoRouteFoundError when no line path exists', async () => {
    await expect(
      getTransitRoute('NONEXISTENT', 'THB', '04:00')
    ).rejects.toThrow(NoRouteFoundError)
    await expect(
      getTransitRoute('NONEXISTENT', 'THB', '04:00')
    ).rejects.toMatchObject({
      message: 'These stations are not connected by any KRL line',
    })
  })

  test('propagates NoRouteFoundError when a leg fails', async () => {
    schedulesByStation = {
      PSMB: [
        createScheduleRow({
          train_id: '1151',
          ka_name: 'COMMUTER LINE BOGOR',
          color: '#E30A16',
        }),
      ],
      MRI: [],
    }
    trainSchedules = {
      '1151': createVirtualTrainRow('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:31:00' },
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:41:00' },
      ]),
    }

    await expect(
      getTransitRoute('PSMB', 'THB', '04:00')
    ).rejects.toThrow(NoRouteFoundError)
  })

  test('strips seconds from chained time_est for next leg timefrom', async () => {
    schedulesByStation = {
      PSMB: [
        createScheduleRow({
          train_id: '1151',
          ka_name: 'COMMUTER LINE BOGOR',
          color: '#E30A16',
        }),
      ],
      MRI: [
        createScheduleRow({
          train_id: '1801',
          ka_name: 'COMMUTER LINE CIKARANG',
          color: '#0000FF',
          time_est: '04:45:00',
        }),
      ],
      THB: [
        createScheduleRow({
          train_id: '217',
          ka_name: 'COMMUTER LINE RANGKASBITUNG',
          color: '#00A651',
          time_est: '05:03:00',
        }),
      ],
    }
    trainSchedules = {
      '1151': createVirtualTrainRow('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:31:00' },
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:41:00' },
      ]),
      '1801': createVirtualTrainRow('1801', 'COMMUTER LINE CIKARANG', '#0000FF', [
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:45:00' },
        { station_id: 'THB', station_name: 'Tanah Abang', time_est: '04:58:00' },
      ]),
      '217': createVirtualTrainRow('217', 'COMMUTER LINE RANGKASBITUNG', '#00A651', [
        { station_id: 'THB', station_name: 'Tanah Abang', time_est: '05:03:00' },
        { station_id: 'RU', station_name: 'Rawa Buntu', time_est: '05:25:00' },
      ]),
    }

    await getTransitRoute('PSMB', 'RU', '04:00')

    const callUrls = (global.fetch as jest.Mock).mock.calls.map(
      (c: [string]) => c[0]
    )

    // Cache key is now coarse (always the full day) regardless of the
    // chained arrival time — filtering by the stripped-seconds time happens
    // in-process instead of being sent upstream as a query param.
    const mriScheduleUrl = callUrls.find(
      (url) =>
        url.includes('/schedules') &&
        url.includes('stationid=MRI')
    )
    expect(mriScheduleUrl).toBeDefined()
    expect(mriScheduleUrl).toContain('timefrom=00%3A00')

    const thbScheduleUrl = callUrls.find(
      (url) =>
        url.includes('/schedules') &&
        url.includes('stationid=THB')
    )
    expect(thbScheduleUrl).toBeDefined()
    expect(thbScheduleUrl).toContain('timefrom=00%3A00')
  })

  test('rejects same-station request with distinct message', async () => {
    await expect(
      getTransitRoute('AC', 'AC', '04:00')
    ).rejects.toThrow(NoRouteFoundError)
    await expect(
      getTransitRoute('AC', 'AC', '04:00')
    ).rejects.toMatchObject({
      message: 'Origin and destination must be different stations',
    })
  })

  test('resolves Bogor → Nambo via Citayam fork as two legs', async () => {
    schedulesByStation = {
      BOO: [
        createScheduleRow({
          train_id: '1151',
          ka_name: 'COMMUTER LINE BOGOR',
          color: '#E30A16',
        }),
      ],
      CTA: [
        createScheduleRow({
          train_id: '1152',
          ka_name: 'COMMUTER LINE NAMBO',
          color: '#E30A16',
          time_est: '04:15:00',
        }),
      ],
    }
    trainSchedules = {
      '1151': createVirtualTrainRow('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'BOO', station_name: 'BOGOR', time_est: '04:00:00' },
        { station_id: 'CTA', station_name: 'CITAYAM', time_est: '04:10:00' },
      ]),
      '1152': createVirtualTrainRow('1152', 'COMMUTER LINE NAMBO', '#E30A16', [
        { station_id: 'CTA', station_name: 'CITAYAM', time_est: '04:15:00' },
        { station_id: 'NMO', station_name: 'NAMBO', time_est: '04:30:00' },
      ]),
    }

    const legs = await getTransitRoute('BOO', 'NMO', '04:00')

    expect(legs).toHaveLength(2)
    expect(legs[0].train_id).toBe('1151')
    expect(legs[0].stops.map((s) => s.station_id)).toEqual(['BOO', 'CTA'])
    expect(legs[1].train_id).toBe('1152')
    expect(legs[1].stops.map((s) => s.station_id)).toEqual(['CTA', 'NMO'])
  })

  test('resolves same-branch Depok → Bogor as single leg (regression)', async () => {
    schedulesByStation = {
      DP: [
        createScheduleRow({
          train_id: '1151',
          ka_name: 'COMMUTER LINE BOGOR',
          color: '#E30A16',
        }),
      ],
    }
    trainSchedules = {
      '1151': createVirtualTrainRow('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'DP', station_name: 'DEPOK', time_est: '04:00:00' },
        { station_id: 'CTA', station_name: 'CITAYAM', time_est: '04:05:00' },
        { station_id: 'BOO', station_name: 'BOGOR', time_est: '04:20:00' },
      ]),
    }

    const legs = await getTransitRoute('DP', 'BOO', '04:00')

    expect(legs).toHaveLength(1)
    expect(legs[0].train_id).toBe('1151')
  })

  test('throws distinct message when graph has path but no real train connects', async () => {
    schedulesByStation = {
      PSMB: [
        createScheduleRow({
          train_id: '1151',
          ka_name: 'COMMUTER LINE BOGOR',
          color: '#E30A16',
        }),
      ],
      MRI: [],
    }
    trainSchedules = {
      '1151': createVirtualTrainRow('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:31:00' },
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:41:00' },
      ]),
    }

    await expect(
      getTransitRoute('PSMB', 'DU', '04:00')
    ).rejects.toThrow(NoRouteFoundError)
    await expect(
      getTransitRoute('PSMB', 'DU', '04:00')
    ).rejects.toMatchObject({
      message: 'No trains currently connecting these stations at this time',
    })
  })

  test('delegates to single-leg even when stations share no line (stranger-pair gets direct route)', async () => {
    schedulesByStation = {
      JAKK: [
        createScheduleRow({
          train_id: '1151',
          ka_name: 'COMMUTER LINE BOGOR',
          color: '#E30A16',
        }),
      ],
    }
    trainSchedules = {
      '1151': createVirtualTrainRow('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'JAKK', station_name: 'Jakarta Kota', time_est: '04:00:00' },
        { station_id: 'THB', station_name: 'Tanah Abang', time_est: '04:15:00' },
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:30:00' },
      ]),
    }

    const legs = await getTransitRoute('JAKK', 'MRI', '04:00')

    expect(legs).toHaveLength(1)
    expect(legs[0].stops.map((s) => s.station_id)).toEqual(['JAKK', 'THB', 'MRI'])
  })

  test('skips the doomed direct-route probe when origin and destination share no line', async () => {
    // AK (blue only) and JUA (red only) share no line — only connected via
    // the MRI junction. Before the fix, getTransitRoute always tried a
    // direct route first, which still fetches getSchedules(AK) even though
    // it's topologically guaranteed to fail, wasting part of the shared
    // ROUTE_SEARCH_BUDGET_MS. Assert /schedules?stationid=AK is only ever
    // fetched once (from the real AK->MRI hop), not twice.
    schedulesByStation = {
      AK: [
        createScheduleRow({
          train_id: '5500A',
          ka_name: 'COMMUTER LINE CIKARANG',
          color: '#0084D8',
        }),
      ],
      MRI: [
        createScheduleRow({
          train_id: '1151',
          ka_name: 'COMMUTER LINE BOGOR',
          color: '#E30A16',
          time_est: '04:35:00',
        }),
      ],
    }
    trainSchedules = {
      '5500A': createVirtualTrainRow('5500A', 'COMMUTER LINE CIKARANG', '#0084D8', [
        { station_id: 'AK', station_name: 'Angke', time_est: '04:10:00' },
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:30:00' },
      ]),
      '1151': createVirtualTrainRow('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:35:00' },
        { station_id: 'JUA', station_name: 'Juanda', time_est: '04:45:00' },
      ]),
    }

    const legs = await getTransitRoute('AK', 'JUA', '04:00')

    expect(legs).toHaveLength(2)
    expect(legs[0].stops.map((s) => s.station_id)).toEqual(['AK', 'MRI'])
    expect(legs[1].stops.map((s) => s.station_id)).toEqual(['MRI', 'JUA'])

    const akScheduleCalls = (global.fetch as jest.Mock).mock.calls.filter(
      (c: [string]) => c[0].includes('/schedules') && c[0].includes('stationid=AK')
    )
    expect(akScheduleCalls).toHaveLength(1)
  })

  describe('with onHop (progressive/partial-failure mode)', () => {
    test('reports each successful hop and returns all legs on full success', async () => {
      schedulesByStation = {
        PSMB: [
          createScheduleRow({
            train_id: '1151',
            ka_name: 'COMMUTER LINE BOGOR',
            color: '#E30A16',
          }),
        ],
        MRI: [
          createScheduleRow({
            train_id: '1801',
            ka_name: 'COMMUTER LINE CIKARANG',
            color: '#0000FF',
            time_est: '04:45:00',
          }),
        ],
      }
      trainSchedules = {
        '1151': createVirtualTrainRow('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
          { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:31:00' },
          { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:41:00' },
        ]),
        '1801': createVirtualTrainRow('1801', 'COMMUTER LINE CIKARANG', '#0000FF', [
          { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:45:00' },
          { station_id: 'THB', station_name: 'Tanah Abang', time_est: '04:58:00' },
        ]),
      }

      const events: Array<{ hop: unknown; ok: boolean }> = []
      const legs = await getTransitRoute('PSMB', 'THB', '04:00', (hop, outcome) => {
        events.push({ hop, ok: outcome.ok })
      })

      expect(legs).toHaveLength(2)
      expect(events).toHaveLength(2)
      expect(events.every((e) => e.ok)).toBe(true)
      expect(events[0].hop).toMatchObject({ index: 0, total: 2, from: 'PSMB', to: 'MRI' })
      expect(events[1].hop).toMatchObject({ index: 1, total: 2, from: 'MRI', to: 'THB' })
    })

    test('does not throw on partial failure — returns legs found so far and marks the rest blocked', async () => {
      schedulesByStation = {
        PSMB: [
          createScheduleRow({
            train_id: '1151',
            ka_name: 'COMMUTER LINE BOGOR',
            color: '#E30A16',
          }),
        ],
        MRI: [],
      }
      trainSchedules = {
        '1151': createVirtualTrainRow('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
          { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:31:00' },
          { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:41:00' },
        ]),
      }

      const events: Array<{
        index: number
        ok: boolean
        blocked?: boolean
      }> = []
      const legs = await getTransitRoute('PSMB', 'THB', '04:00', (hop, outcome) => {
        events.push({
          index: hop.index,
          ok: outcome.ok,
          blocked: outcome.ok ? undefined : outcome.blocked,
        })
      })

      // leg 1 (PSMB -> MRI) succeeded and is returned even though leg 2 failed
      expect(legs).toHaveLength(1)
      expect(legs[0].train_id).toBe('1151')

      expect(events).toEqual([
        { index: 0, ok: true, blocked: undefined },
        { index: 1, ok: false, blocked: undefined },
      ])
    })

    test('blocks every hop after a failed one instead of guessing a time to search from', async () => {
      schedulesByStation = {
        PSMB: [
          createScheduleRow({
            train_id: '1151',
            ka_name: 'COMMUTER LINE BOGOR',
            color: '#E30A16',
          }),
        ],
        MRI: [],
        THB: [],
      }
      trainSchedules = {
        '1151': createVirtualTrainRow('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
          { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:31:00' },
          { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:41:00' },
        ]),
      }

      const events: Array<{ index: number; ok: boolean; blocked?: boolean }> = []
      const legs = await getTransitRoute('PSMB', 'RU', '04:00', (hop, outcome) => {
        events.push({
          index: hop.index,
          ok: outcome.ok,
          blocked: outcome.ok ? undefined : outcome.blocked,
        })
      })

      expect(legs).toHaveLength(1)
      expect(events).toEqual([
        { index: 0, ok: true, blocked: undefined },
        { index: 1, ok: false, blocked: undefined },
        { index: 2, ok: false, blocked: true },
      ])
    })

    test('reports a single blocked-from-the-start hop when stations share no line at all', async () => {
      const events: Array<{ index: number; total: number; ok: boolean }> = []
      const legs = await getTransitRoute('NONEXISTENT', 'THB', '04:00', (hop, outcome) => {
        events.push({ index: hop.index, total: hop.total, ok: outcome.ok })
      })

      expect(legs).toEqual([])
      expect(events).toEqual([{ index: 0, total: 0, ok: false }])
    })
  })
})
