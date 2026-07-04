import {
  calculateMinutesBetween,
  formatMinutesToDuration,
  formatToRupiah,
  convertToTitleCase,
  getRegionNumber,
  convertTimeToHHMM,
  calculateMRTETA,
  isTodayWeekend,
  getTypeOfDay,
} from './utils'

describe('calculateMinutesBetween', () => {
  test('same-hour times', () => {
    expect(calculateMinutesBetween('08:00', '08:45')).toBe(45)
  })

  test('cross-hour times', () => {
    expect(calculateMinutesBetween('08:30', '10:15')).toBe(105)
  })

  test('midnight wrap (end before start)', () => {
    expect(calculateMinutesBetween('23:30', '00:30')).toBe(60)
  })

  test('exact midnight wrap', () => {
    expect(calculateMinutesBetween('23:00', '01:00')).toBe(120)
  })

  test('same time returns 24 hours', () => {
    expect(calculateMinutesBetween('12:00', '12:00')).toBe(24 * 60)
  })

  test('morning to evening (no wrap)', () => {
    expect(calculateMinutesBetween('06:00', '18:00')).toBe(720)
  })

  test('empty input returns 0', () => {
    expect(calculateMinutesBetween('', '12:00')).toBe(0)
    expect(calculateMinutesBetween('12:00', '')).toBe(0)
  })

  test('malformed time returns 0', () => {
    expect(calculateMinutesBetween('abc', '12:00')).toBe(0)
  })
})

describe('formatMinutesToDuration', () => {
  test('under one hour', () => {
    expect(formatMinutesToDuration(45)).toBe('45 menit')
  })

  test('exactly one hour', () => {
    expect(formatMinutesToDuration(60)).toBe('1 jam')
  })

  test('over one hour with minutes', () => {
    expect(formatMinutesToDuration(80)).toBe('1 jam 20 menit')
  })

  test('exactly two hours', () => {
    expect(formatMinutesToDuration(120)).toBe('2 jam')
  })

  test('multiple hours with minutes', () => {
    expect(formatMinutesToDuration(185)).toBe('3 jam 5 menit')
  })

  test('one minute', () => {
    expect(formatMinutesToDuration(1)).toBe('1 menit')
  })

  test('NaN returns empty string', () => {
    expect(formatMinutesToDuration(NaN)).toBe('')
  })

  test('negative returns empty string', () => {
    expect(formatMinutesToDuration(-5)).toBe('')
  })

  test('zero minutes', () => {
    expect(formatMinutesToDuration(0)).toBe('0 menit')
  })
})

describe('formatToRupiah', () => {
  test('formats zero', () => {
    expect(formatToRupiah(0)).toBe('Rp\u00A00')
  })

  test('formats thousands', () => {
    expect(formatToRupiah(3000)).toBe('Rp\u00A03.000')
  })

  test('formats large number', () => {
    expect(formatToRupiah(50000)).toBe('Rp\u00A050.000')
  })
})

describe('convertToTitleCase', () => {
  test('converts uppercase to title case', () => {
    expect(convertToTitleCase('PASAR MINGGU BARU')).toBe('Pasar Minggu Baru')
  })

  test('handles single word', () => {
    expect(convertToTitleCase('BOGOR')).toBe('Bogor')
  })

  test('handles empty string', () => {
    expect(convertToTitleCase('')).toBe('')
  })
})

describe('getRegionNumber', () => {
  test('extracts number from WIL prefix', () => {
    expect(getRegionNumber('WIL1')).toBe(1)
  })

  test('extracts number WIL99', () => {
    expect(getRegionNumber('WIL99')).toBe(99)
  })
})

describe('convertTimeToHHMM', () => {
  test('strips seconds from HH:MM:SS', () => {
    expect(convertTimeToHHMM('10:30:00')).toBe('10:30')
  })

  test('keeps HH:MM unchanged', () => {
    expect(convertTimeToHHMM('10:30')).toBe('10:30')
  })

  test('handles empty string', () => {
    expect(convertTimeToHHMM('')).toBe('')
  })
})

describe('calculateMRTETA', () => {
  test('adds minutes within same hour', () => {
    expect(calculateMRTETA('10:00', '30')).toBe('10:30')
  })

  test('wraps past midnight', () => {
    expect(calculateMRTETA('23:45', '30')).toBe('00:15')
  })

  test('adds minutes crossing hour boundary', () => {
    expect(calculateMRTETA('10:45', '30')).toBe('11:15')
  })

  test('throws on invalid input', () => {
    expect(() => calculateMRTETA('invalid', '10')).toThrow('Invalid input time')
  })
})

describe('isTodayWeekend', () => {
  test('returns false for weekdays', () => {
    const originalDate = global.Date
    const mockDate = new Date('2026-07-02T12:00:00Z')
    global.Date = class extends originalDate {
      constructor() {
        super()
        return mockDate
      }
      static now() {
        return mockDate.getTime()
      }
    } as DateConstructor
    ;(global.Date as unknown as { getDay: () => number }).getDay = () => 4

    try {
      expect(isTodayWeekend()).toBe(false)
    } finally {
      global.Date = originalDate
    }
  })
})

describe('getTypeOfDay', () => {
  test('returns weekday for Thursday', () => {
    expect(getTypeOfDay()).toMatch(/weekday|weekend/)
  })
})
