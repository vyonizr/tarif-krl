/// <reference types="jest" />

import { getStations, getSchedule, getJourney } from './adapter'

jest.mock('./snapshotStore', () => ({
  getRepoLrtScheduleSnapshot: jest.fn(),
}))

const { getRepoLrtScheduleSnapshot } = require('./snapshotStore') as {
  getRepoLrtScheduleSnapshot: jest.Mock
}

beforeEach(() => {
  getRepoLrtScheduleSnapshot.mockReset()
})

describe('getStations', () => {
  test('returns the static station list', async () => {
    const stations = await getStations()
    expect(stations).toHaveLength(18)
    expect(stations.find((s) => s.slug === 'cawang')).toEqual({
      slug: 'cawang',
      name: 'Cawang',
    })
  })
})

describe('getSchedule', () => {
  test('returns the weekday list from the snapshot', async () => {
    getRepoLrtScheduleSnapshot.mockResolvedValue({
      stationId: 'cawang',
      capturedAt: '2026-01-01T00:00:00.000Z',
      weekday: ['05:39', '05:43'],
      holiday: ['05:53'],
    })

    const result = await getSchedule('cawang', 'weekday')

    expect(result).toEqual({ times: ['05:39', '05:43'], capturedAt: '2026-01-01T00:00:00.000Z' })
    expect(getRepoLrtScheduleSnapshot).toHaveBeenCalledWith('cawang')
  })

  test('returns the holiday list from the snapshot', async () => {
    getRepoLrtScheduleSnapshot.mockResolvedValue({
      stationId: 'cawang',
      capturedAt: '2026-01-01T00:00:00.000Z',
      weekday: ['05:39'],
      holiday: ['05:53', '05:57'],
    })

    const result = await getSchedule('cawang', 'holiday')

    expect(result).toEqual({ times: ['05:53', '05:57'], capturedAt: '2026-01-01T00:00:00.000Z' })
  })

  test('returns null when the snapshot is missing', async () => {
    getRepoLrtScheduleSnapshot.mockResolvedValue(null)

    const result = await getSchedule('cawang', 'weekday')

    expect(result).toBeNull()
  })
})

describe('getJourney', () => {
  test('returns a direct journey for two cibubur-branch stations', async () => {
    getRepoLrtScheduleSnapshot.mockResolvedValue({
      stationId: 'harjamukti',
      capturedAt: '2026-01-01T00:00:00.000Z',
      weekday: ['05:18'],
      holiday: ['05:35'],
    })

    const result = await getJourney('harjamukti', 'taman-mini')

    expect(result).toEqual({
      type: 'direct',
      from: 'harjamukti',
      fromName: 'Harjamukti',
      to: 'taman-mini',
      toName: 'Taman Mini',
      headingTowards: 'Dukuh Atas BNI',
      stations: [
        { slug: 'harjamukti', name: 'Harjamukti' },
        { slug: 'ciracas', name: 'Ciracas' },
        { slug: 'kampung-rambutan', name: 'Kampung Rambutan' },
        { slug: 'taman-mini', name: 'Taman Mini' },
      ],
      schedule: {
        weekday: ['05:18'],
        holiday: ['05:35'],
        capturedAt: '2026-01-01T00:00:00.000Z',
      },
    })
    expect(getRepoLrtScheduleSnapshot).toHaveBeenCalledWith('harjamukti')
  })

  test('headingTowards resolves to the outward branch terminus once past the fork', async () => {
    getRepoLrtScheduleSnapshot.mockResolvedValue({
      stationId: 'cawang',
      capturedAt: '',
      weekday: ['06:05'],
      holiday: ['06:21'],
    })

    const result = await getJourney('cawang', 'harjamukti')

    expect(result.type).toBe('direct')
    expect((result as { headingTowards: string }).headingTowards).toBe('Harjamukti')
  })

  test('headingTowards clamps to the fork for a trunk-only trip away from Dukuh Atas', async () => {
    getRepoLrtScheduleSnapshot.mockResolvedValue({
      stationId: 'dukuh-atas-bni',
      capturedAt: '',
      weekday: ['06:05'],
      holiday: ['06:21'],
    })

    const result = await getJourney('dukuh-atas-bni', 'cikoko')

    expect(result.type).toBe('direct')
    expect((result as { headingTowards: string }).headingTowards).toBe('Cawang')
  })

  test('headingTowards is Dukuh Atas BNI for a trunk-only trip heading inward', async () => {
    getRepoLrtScheduleSnapshot.mockResolvedValue({
      stationId: 'cikoko',
      capturedAt: '',
      weekday: ['06:05'],
      holiday: ['06:21'],
    })

    const result = await getJourney('cikoko', 'dukuh-atas-bni')

    expect(result.type).toBe('direct')
    expect((result as { headingTowards: string }).headingTowards).toBe('Dukuh Atas BNI')
  })

  test('returns a transfer journey when crossing from cibubur to bekasi branch', async () => {
    getRepoLrtScheduleSnapshot.mockImplementation((slug: string) =>
      Promise.resolve({
        stationId: slug,
        capturedAt: '',
        weekday: [`${slug}-weekday`],
        holiday: [`${slug}-holiday`],
      })
    )

    const result = await getJourney('harjamukti', 'jati-mulya')

    expect(result.type).toBe('transfer')
    if (result.type !== 'transfer') throw new Error('expected transfer result')
    expect(result.transferStation).toBe('Cawang')
    expect(result.legs[0]).toEqual({
      type: 'direct',
      from: 'harjamukti',
      fromName: 'Harjamukti',
      to: 'cawang',
      toName: 'Cawang',
      headingTowards: 'Dukuh Atas BNI',
      stations: [
        { slug: 'harjamukti', name: 'Harjamukti' },
        { slug: 'ciracas', name: 'Ciracas' },
        { slug: 'kampung-rambutan', name: 'Kampung Rambutan' },
        { slug: 'taman-mini', name: 'Taman Mini' },
        { slug: 'cawang', name: 'Cawang' },
      ],
      schedule: {
        weekday: ['harjamukti-weekday'],
        holiday: ['harjamukti-holiday'],
        capturedAt: '',
      },
    })
    expect(result.legs[1]).toEqual({
      type: 'direct',
      from: 'cawang',
      fromName: 'Cawang',
      to: 'jati-mulya',
      toName: 'Jati Mulya',
      headingTowards: 'Jati Mulya',
      stations: [
        { slug: 'cawang', name: 'Cawang' },
        { slug: 'halim', name: 'Halim' },
        { slug: 'jati-bening-baru', name: 'Jati Bening Baru' },
        { slug: 'cikunir-1', name: 'Cikunir 1' },
        { slug: 'cikunir-2', name: 'Cikunir 2' },
        { slug: 'bekasi-barat', name: 'Bekasi Barat' },
        { slug: 'jati-mulya', name: 'Jati Mulya' },
      ],
      schedule: { weekday: ['cawang-weekday'], holiday: ['cawang-holiday'], capturedAt: '' },
    })
  })

  test('throws when the snapshot for a leg origin is missing', async () => {
    getRepoLrtScheduleSnapshot.mockResolvedValue(null)

    await expect(getJourney('harjamukti', 'taman-mini')).rejects.toThrow(
      'Missing schedule snapshot for station: harjamukti'
    )
  })
})
