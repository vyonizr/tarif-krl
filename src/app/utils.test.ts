import { calculateMinutesBetween, formatMinutesToDuration } from './utils'

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
