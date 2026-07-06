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

    expect(result).toEqual(['05:39', '05:43'])
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

    expect(result).toEqual(['05:53', '05:57'])
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
      capturedAt: '',
      weekday: ['05:18'],
      holiday: ['05:35'],
    })

    const result = await getJourney('harjamukti', 'taman-mini')

    expect(result).toEqual({
      type: 'direct',
      from: 'harjamukti',
      to: 'taman-mini',
      headingTowards: 'Dukuh Atas BNI',
      schedule: { weekday: ['05:18'], holiday: ['05:35'] },
    })
    expect(getRepoLrtScheduleSnapshot).toHaveBeenCalledWith('harjamukti')
  })

  test('headingTowards resolves to the outward branch terminus', async () => {
    getRepoLrtScheduleSnapshot.mockResolvedValue({
      stationId: 'dukuh-atas-bni',
      capturedAt: '',
      weekday: ['06:05'],
      holiday: ['06:21'],
    })

    const result = await getJourney('dukuh-atas-bni', 'harjamukti')

    expect(result.type).toBe('direct')
    expect((result as { headingTowards: string }).headingTowards).toBe('Harjamukti')
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
      to: 'cawang',
      headingTowards: 'Dukuh Atas BNI',
      schedule: { weekday: ['harjamukti-weekday'], holiday: ['harjamukti-holiday'] },
    })
    expect(result.legs[1]).toEqual({
      type: 'direct',
      from: 'cawang',
      to: 'jati-mulya',
      headingTowards: 'Jati Mulya',
      schedule: { weekday: ['cawang-weekday'], holiday: ['cawang-holiday'] },
    })
  })

  test('throws when the snapshot for a leg origin is missing', async () => {
    getRepoLrtScheduleSnapshot.mockResolvedValue(null)

    await expect(getJourney('harjamukti', 'taman-mini')).rejects.toThrow(
      'Missing schedule snapshot for station: harjamukti'
    )
  })
})
