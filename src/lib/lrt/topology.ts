export const TRUNK: readonly string[] = [
  'dukuh-atas-bni',
  'setiabudi',
  'rasuna-said',
  'kuningan',
  'pancoran-bank-bjb',
  'cikoko',
  'ciliwung',
  'cawang',
]

export const CIBUBUR_BRANCH: readonly string[] = [
  'taman-mini',
  'kampung-rambutan',
  'ciracas',
  'harjamukti',
]

export const BEKASI_BRANCH: readonly string[] = [
  'halim',
  'jati-bening-baru',
  'cikunir-1',
  'cikunir-2',
  'bekasi-barat',
  'jati-mulya',
]

export const FORK_POINT = 'cawang'

export const CIBUBUR_LINE_ORDER: readonly string[] = [
  ...[...CIBUBUR_BRANCH].reverse(),
  ...[...TRUNK].reverse(),
]

export const BEKASI_LINE_ORDER: readonly string[] = [...TRUNK, ...BEKASI_BRANCH]

function resolveLineOrder(from: string, to: string): readonly string[] | null {
  if (CIBUBUR_LINE_ORDER.includes(from) && CIBUBUR_LINE_ORDER.includes(to)) {
    return CIBUBUR_LINE_ORDER
  }
  if (BEKASI_LINE_ORDER.includes(from) && BEKASI_LINE_ORDER.includes(to)) {
    return BEKASI_LINE_ORDER
  }
  return null
}

export { resolveLineOrder }
