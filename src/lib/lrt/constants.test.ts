import { LRT_STATIONS } from './constants'

describe('LRT_STATIONS', () => {
  test('has 18 unique stations', () => {
    expect(LRT_STATIONS).toHaveLength(18)
    const slugs = new Set(LRT_STATIONS.map((s) => s.slug))
    expect(slugs.size).toBe(18)
  })

  test('includes both branch termini and the fork point', () => {
    const slugs = LRT_STATIONS.map((s) => s.slug)
    expect(slugs).toEqual(
      expect.arrayContaining(['dukuh-atas-bni', 'cawang', 'harjamukti', 'jati-mulya'])
    )
  })

  test('every slug is lowercase kebab-case', () => {
    for (const { slug } of LRT_STATIONS) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })
})
