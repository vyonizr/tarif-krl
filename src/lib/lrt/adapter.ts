import { LRT_STATIONS } from './constants'
import {
  CIBUBUR_LINE_ORDER,
  BEKASI_LINE_ORDER,
  FORK_POINT,
  resolveLineOrder,
} from './topology'
import { getRepoLrtScheduleSnapshot } from './snapshotStore'
import { ILRTStation, LRTDayType, ILRTDirectJourney, ILRTJourneyResult } from './types'

function stationName(slug: string): string {
  const station = LRT_STATIONS.find((s) => s.slug === slug)
  if (!station) throw new Error(`Unknown LRT station: ${slug}`)
  return station.name
}

async function getStations(): Promise<ILRTStation[]> {
  return [...LRT_STATIONS]
}

async function getSchedule(slug: string, dayType: LRTDayType): Promise<string[] | null> {
  const snapshot = await getRepoLrtScheduleSnapshot(slug)
  if (!snapshot) return null
  return snapshot[dayType]
}

async function buildDirectLeg(
  path: readonly string[],
  from: string,
  to: string
): Promise<ILRTDirectJourney> {
  const fromIndex = path.indexOf(from)
  const toIndex = path.indexOf(to)
  const headingTowardsSlug = toIndex > fromIndex ? path[path.length - 1] : path[0]

  const snapshot = await getRepoLrtScheduleSnapshot(from)
  if (!snapshot) {
    throw new Error(`Missing schedule snapshot for station: ${from}`)
  }

  return {
    type: 'direct',
    from,
    to,
    headingTowards: stationName(headingTowardsSlug),
    schedule: { weekday: snapshot.weekday, holiday: snapshot.holiday },
  }
}

async function getJourney(from: string, to: string): Promise<ILRTJourneyResult> {
  const path = resolveLineOrder(from, to)
  if (path) {
    return buildDirectLeg(path, from, to)
  }

  const fromPath = CIBUBUR_LINE_ORDER.includes(from) ? CIBUBUR_LINE_ORDER : BEKASI_LINE_ORDER
  const toPath = fromPath === CIBUBUR_LINE_ORDER ? BEKASI_LINE_ORDER : CIBUBUR_LINE_ORDER

  const [leg1, leg2] = await Promise.all([
    buildDirectLeg(fromPath, from, FORK_POINT),
    buildDirectLeg(toPath, FORK_POINT, to),
  ])

  return {
    type: 'transfer',
    transferStation: stationName(FORK_POINT),
    legs: [leg1, leg2],
  }
}

export { getStations, getSchedule, getJourney }
