import { LRT_STATIONS } from './constants'
import {
  CIBUBUR_LINE_ORDER,
  BEKASI_LINE_ORDER,
  FORK_POINT,
  TRUNK,
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

async function getSchedule(
  slug: string,
  dayType: LRTDayType
): Promise<{ times: string[]; capturedAt: string } | null> {
  const snapshot = await getRepoLrtScheduleSnapshot(slug)
  if (!snapshot) return null
  return { times: snapshot[dayType], capturedAt: snapshot.capturedAt }
}

async function buildDirectLeg(
  path: readonly string[],
  from: string,
  to: string
): Promise<ILRTDirectJourney> {
  const fromIndex = path.indexOf(from)
  const toIndex = path.indexOf(to)
  let headingTowardsSlug = toIndex > fromIndex ? path[path.length - 1] : path[0]

  // Both branches share the trunk, so a trunk-only trip heading away from Dukuh
  // Atas can't claim a specific branch terminus: the train serving it may end at
  // either fork. Cawang is the furthest point that's certain.
  if (headingTowardsSlug !== 'dukuh-atas-bni' && TRUNK.includes(from) && TRUNK.includes(to)) {
    headingTowardsSlug = FORK_POINT
  }

  const snapshot = await getRepoLrtScheduleSnapshot(from)
  if (!snapshot) {
    throw new Error(`Missing schedule snapshot for station: ${from}`)
  }

  return {
    type: 'direct',
    from,
    fromName: stationName(from),
    to,
    toName: stationName(to),
    headingTowards: stationName(headingTowardsSlug),
    schedule: {
      weekday: snapshot.weekday,
      holiday: snapshot.holiday,
      capturedAt: snapshot.capturedAt,
    },
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
