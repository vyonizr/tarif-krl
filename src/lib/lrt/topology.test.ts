import {
  CIBUBUR_LINE_ORDER,
  BEKASI_LINE_ORDER,
  FORK_POINT,
  resolveLineOrder,
} from './topology'

describe('resolveLineOrder', () => {
  test('resolves two trunk stations via the cibubur order', () => {
    expect(resolveLineOrder('setiabudi', 'cikoko')).toBe(CIBUBUR_LINE_ORDER)
  })

  test('resolves two cibubur-branch-only stations', () => {
    expect(resolveLineOrder('harjamukti', 'taman-mini')).toBe(CIBUBUR_LINE_ORDER)
  })

  test('resolves two bekasi-branch-only stations', () => {
    expect(resolveLineOrder('jati-mulya', 'halim')).toBe(BEKASI_LINE_ORDER)
  })

  test('resolves a trunk station to a cibubur-branch station', () => {
    expect(resolveLineOrder('dukuh-atas-bni', 'harjamukti')).toBe(CIBUBUR_LINE_ORDER)
  })

  test('resolves a trunk station to a bekasi-branch station', () => {
    expect(resolveLineOrder('dukuh-atas-bni', 'jati-mulya')).toBe(BEKASI_LINE_ORDER)
  })

  test('returns null when crossing from the cibubur branch to the bekasi branch', () => {
    expect(resolveLineOrder('harjamukti', 'jati-mulya')).toBeNull()
  })

  test('fork point is cawang', () => {
    expect(FORK_POINT).toBe('cawang')
  })
})
