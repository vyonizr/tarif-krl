/// <reference types="jest" />

import { getStations, getFare, getSchedules, getTrainSchedule, getRoute, getTransitRoute, tryRouteWithSameLineSplit } from './adapter'
import { UpstreamError, NoRouteFoundError, KciStationRow, FetchMeta, KciScheduleRow, KciTrainScheduleRow } from './types'
import { getLineGraph, getForkPoint } from './topology'

jest.mock('./snapshotStore', () => {
  const actual = jest.requireActual('./snapshotStore')
  return {
    ...actual,
    getScheduleSnapshot: jest.fn(),
    getRepoScheduleSnapshot: jest.fn(),
    getTrainSnapshot: jest.fn(),
    getRepoTrainScheduleSnapshot: jest.fn(),
  }
})

const {
  getScheduleSnapshot,
  getRepoScheduleSnapshot,
  getTrainSnapshot,
  getRepoTrainScheduleSnapshot,
} = require('./snapshotStore') as {
  getScheduleSnapshot: jest.Mock
  getRepoScheduleSnapshot: jest.Mock
  getTrainSnapshot: jest.Mock
  getRepoTrainScheduleSnapshot: jest.Mock
}

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

function createVirtualTrainRows(
  train_id: string,
  ka_name: string,
  color: string,
  stops: Array<{ station_id: string; station_name: string; time_est: string }>
): KciTrainScheduleRow[] {
  return stops.map((s) => createTrainRow(s.station_id, s.station_name, s.time_est, { color }))
}

function snapshot(data: KciScheduleRow[]): { data: KciScheduleRow[]; capturedAt: string } {
  return { data, capturedAt: '2025-01-01T00:01:00.000Z' }
}

function trainSnapshot(data: KciTrainScheduleRow[]): { data: KciTrainScheduleRow[]; capturedAt: string } {
  return { data, capturedAt: '2025-01-01T00:01:00.000Z' }
}

beforeEach(() => {
  jest.restoreAllMocks()
})

// ──── getStations ─────────────────────────────────────────────

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
        ],
      })
    )

    const result = await getStations()

    expect(result).toEqual({
      Jabodetabek: [
        { id: 'AC', name: 'Ancol' },
        { id: 'BPR', name: 'Bogor Paledang' },
      ],
      Yogyakarta: [{ id: 'YK', name: 'Yogyakarta' }],
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
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const result = getStations()
    await expect(result).rejects.toThrow(UpstreamError)
    await expect(result).rejects.toMatchObject({
      status: 502,
      message: 'Upstream KRL API unavailable',
    })
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})

// ──── getFare ──────────────────────────────────────────────────

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

    expect(result).toEqual([{ from: 'AC', to: 'BPR', fare: 3000, distance: '23.205' }])
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
    global.fetch = jest.fn().mockResolvedValue(createFetchResponse({}, false, 404))

    await expect(getFare('AC', 'BPR')).rejects.toMatchObject({
      status: 502,
      message: 'Upstream returned HTTP 404',
    })
  })
})

// ──── getSchedules (snapshot-primary) ──────────────────────────

describe('getSchedules', () => {
  beforeEach(() => {
    getScheduleSnapshot.mockReset()
    getRepoScheduleSnapshot.mockReset()
  })

  test('returns filtered data from blob snapshot', async () => {
    getScheduleSnapshot.mockResolvedValue(
      snapshot([
        createScheduleRow({ train_id: '1', ka_name: 'COMMUTER LINE BOGOR', time_est: '10:30:00' }),
        createScheduleRow({ train_id: '2', ka_name: 'COMMUTER LINE CIKARANG', time_est: '09:00:00' }),
      ])
    )
    getRepoScheduleSnapshot.mockResolvedValue(null)

    const result = await getSchedules('STA1', '10:00', '22:00')

    expect(result).toHaveLength(1)
    expect(result[0].train_id).toBe('1')
    expect(getScheduleSnapshot).toHaveBeenCalledWith('STA1')
    expect(getRepoScheduleSnapshot).not.toHaveBeenCalled()
  })

  test('falls back to repo snapshot when blob not available', async () => {
    getScheduleSnapshot.mockResolvedValue(null)
    getRepoScheduleSnapshot.mockResolvedValue(
      snapshot([
        createScheduleRow({ train_id: '1', time_est: '10:30:00' }),
      ])
    )

    const result = await getSchedules('STA1', '10:00')

    expect(result).toHaveLength(1)
    expect(getScheduleSnapshot).toHaveBeenCalledWith('STA1')
    expect(getRepoScheduleSnapshot).toHaveBeenCalledWith('STA1')
  })

  test('returns empty array when no snapshot available', async () => {
    getScheduleSnapshot.mockResolvedValue(null)
    getRepoScheduleSnapshot.mockResolvedValue(null)

    const result = await getSchedules('STA1', '10:00')

    expect(result).toEqual([])
  })

  test('filters out non-passenger trains from snapshot data', async () => {
    getScheduleSnapshot.mockResolvedValue(
      snapshot([
        createScheduleRow({ train_id: '1', ka_name: 'COMMUTER LINE BOGOR', time_est: '10:00:00' }),
        createScheduleRow({ train_id: '2', ka_name: 'TIDAK ANGKUT PENUMPANG', time_est: '10:05:00' }),
        createScheduleRow({ train_id: '3', ka_name: 'COMMUTER LINE CIKARANG', time_est: '10:10:00' }),
      ])
    )
    getRepoScheduleSnapshot.mockResolvedValue(null)

    const result = await getSchedules('STA1', '10:00')

    expect(result).toHaveLength(2)
    expect(result.map((s) => s.train_id)).toEqual(['1', '3'])
  })

  test('filters results to the requested window', async () => {
    getScheduleSnapshot.mockResolvedValue(
      snapshot([
        createScheduleRow({ train_id: '1', time_est: '09:00:00' }),
        createScheduleRow({ train_id: '2', time_est: '10:30:00' }),
        createScheduleRow({ train_id: '3', time_est: '22:30:00' }),
      ])
    )

    const result = await getSchedules('STA1', '10:00', '22:00')

    expect(result.map((s) => s.train_id)).toEqual(['2'])
  })
})

// ──── getRoute (snapshot-primary) ──────────────────────────────

describe('getRoute', () => {
  function setupRouteSchedules(stationId: string, rows: KciScheduleRow[]) {
    getScheduleSnapshot.mockImplementation((id: string) => {
      if (id === stationId) return Promise.resolve(snapshot(rows))
      return Promise.resolve(null)
    })
    getRepoScheduleSnapshot.mockResolvedValue(null)
  }

  function setupTrainSchedules(schedules: Record<string, KciTrainScheduleRow[]>) {
    getTrainSnapshot.mockImplementation((id: string) => {
      const data = schedules[id]
      return Promise.resolve(data ? trainSnapshot(data) : null)
    })
    getRepoTrainScheduleSnapshot.mockImplementation((id: string) => {
      const data = schedules[id]
      return Promise.resolve(data ? trainSnapshot(data) : null)
    })
  }

  beforeEach(() => {
    getScheduleSnapshot.mockReset()
    getRepoScheduleSnapshot.mockReset()
    getTrainSnapshot.mockReset()
    getRepoTrainScheduleSnapshot.mockReset()
    getScheduleSnapshot.mockResolvedValue(null)
    getRepoScheduleSnapshot.mockResolvedValue(null)
    getTrainSnapshot.mockResolvedValue(null)
    getRepoTrainScheduleSnapshot.mockResolvedValue(null)
  })

  test('returns sliced stop list when first candidate covers both stations', async () => {
    setupRouteSchedules('PSMB', [createScheduleRow({ train_id: '1151' })])
    setupTrainSchedules({
      '1151': createVirtualTrainRows('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:31:00' },
        { station_id: 'DRN', station_name: 'Duren Kalibata', time_est: '04:32:00' },
        { station_id: 'CW', station_name: 'Cawang', time_est: '04:34:00' },
        { station_id: 'JAKK', station_name: 'Jakarta Kota', time_est: '05:03:00' },
      ]),
    })

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
    setupRouteSchedules('PSMB', [
      createScheduleRow({ train_id: '1151' }),
      createScheduleRow({ train_id: '1152', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' }),
    ])
    setupTrainSchedules({
      '1151': createVirtualTrainRows('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:31:00' },
        { station_id: 'DRN', station_name: 'Duren Kalibata', time_est: '04:32:00' },
      ]),
      '1152': createVirtualTrainRows('1152', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:35:00' },
        { station_id: 'CW', station_name: 'Cawang', time_est: '04:37:00' },
        { station_id: 'JAKK', station_name: 'Jakarta Kota', time_est: '05:03:00' },
      ]),
    })

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
    setupRouteSchedules('PSMB', [
      createScheduleRow({ train_id: '1151' }),
      createScheduleRow({ train_id: '1152', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' }),
    ])
    setupTrainSchedules({
      '1151': createVirtualTrainRows('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'CW', station_name: 'Cawang', time_est: '04:00:00' },
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:02:00' },
      ]),
      '1152': createVirtualTrainRows('1152', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:35:00' },
        { station_id: 'CW', station_name: 'Cawang', time_est: '04:37:00' },
      ]),
    })

    const result = await getRoute('PSMB', 'CW', '04:00')

    expect(result.train_id).toBe('1152')
  })

  test('throws NoRouteFoundError when no candidate matches', async () => {
    setupRouteSchedules('PSMB', [
      createScheduleRow({ train_id: '1151' }),
      createScheduleRow({ train_id: '1152' }),
    ])
    setupTrainSchedules({
      '1151': createVirtualTrainRows('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:31:00' },
        { station_id: 'DRN', station_name: 'Duren Kalibata', time_est: '04:32:00' },
      ]),
      '1152': createVirtualTrainRows('1152', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'CW', station_name: 'Cawang', time_est: '04:35:00' },
        { station_id: 'JAKK', station_name: 'Jakarta Kota', time_est: '05:03:00' },
      ]),
    })

    await expect(getRoute('PSMB', 'JAKK', '04:00')).rejects.toThrow(NoRouteFoundError)
  })

  test('computes timeTo from timeFrom using ROUTE_SEARCH_WINDOW_HOURS to filter candidates', async () => {
    setupRouteSchedules('PSMB', [
      createScheduleRow({ train_id: '1151', time_est: '10:05:00' }),
      createScheduleRow({ train_id: '1152', time_est: '13:05:00' }),
    ])
    setupTrainSchedules({
      '1151': createVirtualTrainRows('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '10:31:00' },
        { station_id: 'CW', station_name: 'Cawang', time_est: '10:34:00' },
      ]),
      '1152': createVirtualTrainRows('1152', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '13:31:00' },
        { station_id: 'CW', station_name: 'Cawang', time_est: '13:34:00' },
      ]),
    })

    const result = await getRoute('PSMB', 'CW', '10:00')

    expect(result.train_id).toBe('1151')
  })

  test('picks second occurrence of duplicate station (Manggarai → Jatinegara)', async () => {
    setupRouteSchedules('MRI', [
      createScheduleRow({ train_id: '1801', ka_name: 'COMMUTER LINE CIKARANG', color: '#003399' }),
    ])
    setupTrainSchedules({
      '1801': createVirtualTrainRows('1801', 'COMMUTER LINE CIKARANG', '#003399', [
        { station_id: 'CKR', station_name: 'CIKARANG', time_est: '04:00:00' },
        { station_id: 'JNG', station_name: 'JATINEGARA', time_est: '04:15:00' },
        { station_id: 'MTR', station_name: 'MATRAMAN', time_est: '04:25:00' },
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:35:00' },
        { station_id: 'SUD', station_name: 'SUDIRMAN', time_est: '04:42:00' },
        { station_id: 'JNG', station_name: 'JATINEGARA', time_est: '05:10:00' },
        { station_id: 'CKR', station_name: 'CIKARANG', time_est: '05:45:00' },
      ]),
    })

    const result = await getRoute('MRI', 'JNG', '04:00')

    expect(result.stops.map((s) => s.station_id)).toEqual(['MRI', 'SUD', 'JNG'])
    expect(result.stops[2].time_est).toBe('05:10')
  })

  test('picks train closest to departure time when multiple candidates match', async () => {
    setupRouteSchedules('PSMB', [
      createScheduleRow({ train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' }),
      createScheduleRow({ train_id: '1152', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' }),
      createScheduleRow({ train_id: '1153', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' }),
    ])
    setupTrainSchedules({
      '1151': createVirtualTrainRows('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:31:00' },
        { station_id: 'CW', station_name: 'Cawang', time_est: '04:34:00' },
      ]),
      '1152': createVirtualTrainRows('1152', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:02:00' },
        { station_id: 'CW', station_name: 'Cawang', time_est: '04:05:00' },
      ]),
      '1153': createVirtualTrainRows('1153', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:05:00' },
        { station_id: 'CW', station_name: 'Cawang', time_est: '04:08:00' },
      ]),
    })

    const result = await getRoute('PSMB', 'CW', '04:00')

    expect(result.train_id).toBe('1152')
    expect(result.stops[0].time_est).toBe('04:02')
  })

  test('pre-filter skips candidates on different lines', async () => {
    setupRouteSchedules('PSMB', [
      createScheduleRow({ train_id: '1151', ka_name: 'COMMUTER LINE CIKARANG', color: '#003399' }),
      createScheduleRow({ train_id: '1152', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' }),
    ])
    setupTrainSchedules({
      '1151': createVirtualTrainRows('1151', 'COMMUTER LINE CIKARANG', '#003399', [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:31:00' },
        { station_id: 'CW', station_name: 'Cawang', time_est: '04:33:00' },
      ]),
      '1152': createVirtualTrainRows('1152', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:35:00' },
        { station_id: 'CW', station_name: 'Cawang', time_est: '04:37:00' },
      ]),
    })

    const result = await getRoute('PSMB', 'CW', '04:00')

    expect(result.train_id).toBe('1152')
  })
})

// ──── data source tracking ─────────────────────────────────────

describe('data source tracking (FetchMeta)', () => {
  test('marks meta as blob-snapshot from getSchedules', async () => {
    getScheduleSnapshot.mockResolvedValue(
      snapshot([createScheduleRow({ train_id: '1', time_est: '10:00:00' })])
    )
    getRepoScheduleSnapshot.mockResolvedValue(null)

    const meta: FetchMeta = { source: 'blob-snapshot' }
    await getSchedules('STA1', '10:00', '22:00', meta)

    expect(meta.source).toBe('blob-snapshot')
    expect(meta.capturedAt).toBeDefined()
  })

  test('marks meta as repo-snapshot when only repo snapshot available', async () => {
    getScheduleSnapshot.mockResolvedValue(null)
    getRepoScheduleSnapshot.mockResolvedValue(
      snapshot([createScheduleRow({ train_id: '1', time_est: '10:00:00' })])
    )

    const meta: FetchMeta = { source: 'blob-snapshot' }
    await getSchedules('STA1', '10:00', '22:00', meta)

    expect(meta.source).toBe('repo-snapshot')
    expect(meta.capturedAt).toBeDefined()
  })

  test('getTrainSchedule marks blob-snapshot when blob train snapshot present', async () => {
    getTrainSnapshot.mockResolvedValue(
      trainSnapshot([createTrainRow('JAKK', 'Jakarta Kota', '04:00:00')])
    )
    getRepoTrainScheduleSnapshot.mockResolvedValue(null)

    const meta: FetchMeta = { source: 'blob-snapshot' }
    await getTrainSchedule('1151', meta)

    expect(meta.source).toBe('blob-snapshot')
  })

  test('getTrainSchedule marks repo-snapshot when only repo train snapshot available', async () => {
    getTrainSnapshot.mockResolvedValue(null)
    getRepoTrainScheduleSnapshot.mockResolvedValue(
      trainSnapshot([createTrainRow('JAKK', 'Jakarta Kota', '04:00:00')])
    )

    const meta: FetchMeta = { source: 'blob-snapshot' }
    await getTrainSchedule('1151', meta)

    expect(meta.source).toBe('repo-snapshot')
  })
})

// ──── line graph ───────────────────────────────────────────────

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

// ──── getTransitRoute ──────────────────────────────────────────

describe('getTransitRoute', () => {
  function setupSchedules(map: Record<string, KciScheduleRow[]>) {
    getScheduleSnapshot.mockImplementation((id: string) => {
      const data = map[id]
      return Promise.resolve(data ? snapshot(data) : null)
    })
    getRepoScheduleSnapshot.mockResolvedValue(null)
  }

  function setupTrains(map: Record<string, KciTrainScheduleRow[]>) {
    getTrainSnapshot.mockImplementation((id: string) => {
      const data = map[id]
      return Promise.resolve(data ? trainSnapshot(data) : null)
    })
    getRepoTrainScheduleSnapshot.mockImplementation((id: string) => {
      const data = map[id]
      return Promise.resolve(data ? trainSnapshot(data) : null)
    })
  }

  beforeEach(() => {
    jest.restoreAllMocks()
  })

  test('delegates to single-leg getRoute when stations share a line', async () => {
    setupSchedules({
      CW: [createScheduleRow({ train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' })],
    })
    setupTrains({
      '1151': createVirtualTrainRows('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'CW', station_name: 'Cawang', time_est: '04:34:00' },
        { station_id: 'JAKK', station_name: 'Jakarta Kota', time_est: '05:03:00' },
      ]),
    })

    const legs = await getTransitRoute('CW', 'JAKK', '04:00')

    expect(legs).toHaveLength(1)
    expect(legs[0].train_id).toBe('1151')
  })

  test('chains legs across two lines with one transfer', async () => {
    setupSchedules({
      PSMB: [createScheduleRow({ train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' })],
      MRI: [createScheduleRow({ train_id: '1801', ka_name: 'COMMUTER LINE CIKARANG', color: '#0000FF', time_est: '04:45:00' })],
    })
    setupTrains({
      '1151': createVirtualTrainRows('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:31:00' },
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:41:00' },
      ]),
      '1801': createVirtualTrainRows('1801', 'COMMUTER LINE CIKARANG', '#0000FF', [
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:45:00' },
        { station_id: 'THB', station_name: 'Tanah Abang', time_est: '04:58:00' },
      ]),
    })

    const legs = await getTransitRoute('PSMB', 'THB', '04:00')

    expect(legs).toHaveLength(2)
    expect(legs[0].train_id).toBe('1151')
    expect(legs[1].train_id).toBe('1801')
  })

  test('chains three legs with two transfers (PSMB → RU)', async () => {
    setupSchedules({
      PSMB: [createScheduleRow({ train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' })],
      MRI: [createScheduleRow({ train_id: '1801', ka_name: 'COMMUTER LINE CIKARANG', color: '#0000FF', time_est: '04:45:00' })],
      THB: [createScheduleRow({ train_id: '217', ka_name: 'COMMUTER LINE RANGKASBITUNG', color: '#00A651', time_est: '05:03:00' })],
    })
    setupTrains({
      '1151': createVirtualTrainRows('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:31:00' },
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:41:00' },
      ]),
      '1801': createVirtualTrainRows('1801', 'COMMUTER LINE CIKARANG', '#0000FF', [
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:45:00' },
        { station_id: 'THB', station_name: 'Tanah Abang', time_est: '04:58:00' },
      ]),
      '217': createVirtualTrainRows('217', 'COMMUTER LINE RANGKASBITUNG', '#00A651', [
        { station_id: 'THB', station_name: 'Tanah Abang', time_est: '05:03:00' },
        { station_id: 'RU', station_name: 'Rawa Buntu', time_est: '05:25:00' },
      ]),
    })

    const legs = await getTransitRoute('PSMB', 'RU', '04:00')

    expect(legs).toHaveLength(3)
    expect(legs[0].train_id).toBe('1151')
    expect(legs[1].train_id).toBe('1801')
    expect(legs[2].train_id).toBe('217')
  })

  test('throws NoRouteFoundError when no line path exists', async () => {
    setupSchedules({})
    setupTrains({})

    await expect(getTransitRoute('NONEXISTENT', 'THB', '04:00')).rejects.toThrow(NoRouteFoundError)
    await expect(getTransitRoute('NONEXISTENT', 'THB', '04:00')).rejects.toMatchObject({
      message: 'These stations are not connected by any KRL line',
    })
  })

  test('propagates NoRouteFoundError when a leg fails', async () => {
    setupSchedules({
      PSMB: [createScheduleRow({ train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' })],
      MRI: [],
    })
    setupTrains({
      '1151': createVirtualTrainRows('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:31:00' },
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:41:00' },
      ]),
    })

    await expect(getTransitRoute('PSMB', 'THB', '04:00')).rejects.toThrow(NoRouteFoundError)
  })

  test('rejects same-station request with distinct message', async () => {
    await expect(getTransitRoute('AC', 'AC', '04:00')).rejects.toThrow(NoRouteFoundError)
    await expect(getTransitRoute('AC', 'AC', '04:00')).rejects.toMatchObject({
      message: 'Origin and destination must be different stations',
    })
  })

  test('resolves Bogor → Nambo via Citayam fork as two legs', async () => {
    setupSchedules({
      BOO: [createScheduleRow({ train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' })],
      CTA: [createScheduleRow({ train_id: '1152', ka_name: 'COMMUTER LINE NAMBO', color: '#E30A16', time_est: '04:15:00' })],
    })
    setupTrains({
      '1151': createVirtualTrainRows('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'BOO', station_name: 'BOGOR', time_est: '04:00:00' },
        { station_id: 'CTA', station_name: 'CITAYAM', time_est: '04:10:00' },
      ]),
      '1152': createVirtualTrainRows('1152', 'COMMUTER LINE NAMBO', '#E30A16', [
        { station_id: 'CTA', station_name: 'CITAYAM', time_est: '04:15:00' },
        { station_id: 'NMO', station_name: 'NAMBO', time_est: '04:30:00' },
      ]),
    })

    const legs = await getTransitRoute('BOO', 'NMO', '04:00')

    expect(legs).toHaveLength(2)
    expect(legs[0].stops.map((s) => s.station_id)).toEqual(['BOO', 'CTA'])
    expect(legs[1].stops.map((s) => s.station_id)).toEqual(['CTA', 'NMO'])
  })

  test('resolves same-branch Depok → Bogor as single leg', async () => {
    setupSchedules({
      DP: [createScheduleRow({ train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' })],
    })
    setupTrains({
      '1151': createVirtualTrainRows('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'DP', station_name: 'DEPOK', time_est: '04:00:00' },
        { station_id: 'CTA', station_name: 'CITAYAM', time_est: '04:05:00' },
        { station_id: 'BOO', station_name: 'BOGOR', time_est: '04:20:00' },
      ]),
    })

    const legs = await getTransitRoute('DP', 'BOO', '04:00')

    expect(legs).toHaveLength(1)
  })

  test('throws distinct message when graph has path but no real train connects', async () => {
    setupSchedules({
      PSMB: [createScheduleRow({ train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' })],
      MRI: [],
    })
    setupTrains({
      '1151': createVirtualTrainRows('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:31:00' },
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:41:00' },
      ]),
    })

    await expect(getTransitRoute('PSMB', 'DU', '04:00')).rejects.toThrow(NoRouteFoundError)
    await expect(getTransitRoute('PSMB', 'DU', '04:00')).rejects.toMatchObject({
      message: 'No trains currently connecting these stations at this time',
    })
  })

  test('delegates to single-leg even when stations share no line', async () => {
    setupSchedules({
      JAKK: [createScheduleRow({ train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' })],
    })
    setupTrains({
      '1151': createVirtualTrainRows('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'JAKK', station_name: 'Jakarta Kota', time_est: '04:00:00' },
        { station_id: 'THB', station_name: 'Tanah Abang', time_est: '04:15:00' },
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:30:00' },
      ]),
    })

    const legs = await getTransitRoute('JAKK', 'MRI', '04:00')

    expect(legs).toHaveLength(1)
    expect(legs[0].stops.map((s) => s.station_id)).toEqual(['JAKK', 'THB', 'MRI'])
  })

  test('skips the doomed direct-route probe when stations share no line', async () => {
    setupSchedules({
      AK: [createScheduleRow({ train_id: '5500A', ka_name: 'COMMUTER LINE CIKARANG', color: '#0084D8' })],
      MRI: [createScheduleRow({ train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16', time_est: '04:35:00' })],
    })
    setupTrains({
      '5500A': createVirtualTrainRows('5500A', 'COMMUTER LINE CIKARANG', '#0084D8', [
        { station_id: 'AK', station_name: 'Angke', time_est: '04:10:00' },
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:30:00' },
      ]),
      '1151': createVirtualTrainRows('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:35:00' },
        { station_id: 'JUA', station_name: 'Juanda', time_est: '04:45:00' },
      ]),
    })

    const legs = await getTransitRoute('AK', 'JUA', '04:00')

    expect(legs).toHaveLength(2)
    expect(legs[0].stops.map((s) => s.station_id)).toEqual(['AK', 'MRI'])
    expect(legs[1].stops.map((s) => s.station_id)).toEqual(['MRI', 'JUA'])
  })
})

// ──── getTransitRoute with onHop ───────────────────────────────

describe('getTransitRoute with onHop', () => {
  function setupSchedules(map: Record<string, KciScheduleRow[]>) {
    getScheduleSnapshot.mockImplementation((id: string) => {
      const data = map[id]
      return Promise.resolve(data ? snapshot(data) : null)
    })
    getRepoScheduleSnapshot.mockResolvedValue(null)
  }

  function setupTrains(map: Record<string, KciTrainScheduleRow[]>) {
    getTrainSnapshot.mockImplementation((id: string) => {
      const data = map[id]
      return Promise.resolve(data ? trainSnapshot(data) : null)
    })
    getRepoTrainScheduleSnapshot.mockImplementation((id: string) => {
      const data = map[id]
      return Promise.resolve(data ? trainSnapshot(data) : null)
    })
  }

  beforeEach(() => {
    jest.restoreAllMocks()
  })

  test('reports each successful hop and returns all legs on full success', async () => {
    setupSchedules({
      PSMB: [createScheduleRow({ train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' })],
      MRI: [createScheduleRow({ train_id: '1801', ka_name: 'COMMUTER LINE CIKARANG', color: '#0000FF', time_est: '04:45:00' })],
    })
    setupTrains({
      '1151': createVirtualTrainRows('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:31:00' },
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:41:00' },
      ]),
      '1801': createVirtualTrainRows('1801', 'COMMUTER LINE CIKARANG', '#0000FF', [
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:45:00' },
        { station_id: 'THB', station_name: 'Tanah Abang', time_est: '04:58:00' },
      ]),
    })

    const events: Array<{ hop: unknown; ok: boolean }> = []
    const legs = await getTransitRoute('PSMB', 'THB', '04:00', (hop, outcome) => {
      events.push({ hop, ok: outcome.ok })
    })

    expect(legs).toHaveLength(2)
    expect(events).toHaveLength(2)
    expect(events.every((e) => e.ok)).toBe(true)
  })

  test('does not throw on partial failure — returns legs found so far and marks rest blocked', async () => {
    setupSchedules({
      PSMB: [createScheduleRow({ train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' })],
      MRI: [],
    })
    setupTrains({
      '1151': createVirtualTrainRows('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:31:00' },
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:41:00' },
      ]),
    })

    const events: Array<{ index: number; ok: boolean; blocked?: boolean }> = []
    const legs = await getTransitRoute('PSMB', 'THB', '04:00', (hop, outcome) => {
      events.push({
        index: hop.index,
        ok: outcome.ok,
        blocked: outcome.ok ? undefined : outcome.blocked,
      })
    })

    expect(legs).toHaveLength(1)
    expect(legs[0].train_id).toBe('1151')
    expect(events).toEqual([
      { index: 0, ok: true, blocked: undefined },
      { index: 1, ok: false, blocked: undefined },
    ])
  })

  test('blocks every hop after a failed one', async () => {
    setupSchedules({
      PSMB: [createScheduleRow({ train_id: '1151', ka_name: 'COMMUTER LINE BOGOR', color: '#E30A16' })],
      MRI: [],
      THB: [],
    })
    setupTrains({
      '1151': createVirtualTrainRows('1151', 'COMMUTER LINE BOGOR', '#E30A16', [
        { station_id: 'PSMB', station_name: 'Pasar Minggu Baru', time_est: '04:31:00' },
        { station_id: 'MRI', station_name: 'Manggarai', time_est: '04:41:00' },
      ]),
    })

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
    setupSchedules({})
    setupTrains({})

    const events: Array<{ index: number; total: number; ok: boolean }> = []
    const legs = await getTransitRoute('NONEXISTENT', 'THB', '04:00', (hop, outcome) => {
      events.push({ index: hop.index, total: hop.total, ok: outcome.ok })
    })

    expect(legs).toEqual([])
    expect(events).toEqual([{ index: 0, total: 0, ok: false }])
  })
})
