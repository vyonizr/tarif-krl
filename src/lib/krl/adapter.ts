import {
  KCI_BASE_URL,
  REVALIDATE_STATIONS,
  REVALIDATE_FARE,
  REVALIDATE_SCHEDULES,
  UPSTREAM_TIMEOUT_MS,
  UPSTREAM_RETRY_COUNT,
  REVALIDATE_TRAIN_SCHEDULE,
  ROUTE_SEARCH_WINDOW_HOURS,
  MAX_TRANSIT_LEGS,
} from './constants'
import {
  KciStationResponse,
  KciStationRow,
  KciFareResponse,
  KciScheduleResponse,
  KciScheduleRow,
  KciTrainScheduleResponse,
  IKRLRouteStop,
  IKRLRouteResult,
  UpstreamError,
  NoRouteFoundError,
} from './types'
import { getLineGraph, findTransferStations, getForkPoint, LINES } from './topology'
import { convertToTitleCase, convertTimeToHHMM } from '@/app/utils'

const staleCache = new Map<string, { body: string; ts: number }>()

async function fetchWithRetry(
  path: string,
  revalidate: number
): Promise<Response> {
  const maxAttempts = UPSTREAM_RETRY_COUNT + 1
  const url = `${KCI_BASE_URL}/${path}`

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(
      () => controller.abort(),
      UPSTREAM_TIMEOUT_MS
    )

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        next: { revalidate },
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        if (response.status >= 500) {
          throw new Error('retryable upstream 5xx')
        }
        throw new UpstreamError(
          502,
          `Upstream returned HTTP ${response.status}`
        )
      }

      const cloned = response.clone()
      const body = await cloned.text()
      staleCache.set(url, { body, ts: Date.now() })

      return response
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof UpstreamError) {
        const stale = staleCache.get(url)
        if (stale) {
          return new Response(stale.body, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        throw error
      }

      if (attempt === maxAttempts - 1) {
        const stale = staleCache.get(url)
        if (stale) {
          return new Response(stale.body, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        throw new UpstreamError(502, 'Upstream KRL API unavailable')
      }
    }
  }

  const stale = staleCache.get(url)
  if (stale) {
    return new Response(stale.body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  throw new UpstreamError(502, 'Upstream KRL API unavailable')
}

const REGION_OVERRIDES: Record<string, string> = {
  RK: 'Jabodetabek',
}

function parseRegionHeaders(
  rows: KciStationRow[]
): Record<string, { id: string; name: string }[]> {
  const result: Record<string, { id: string; name: string }[]> = {}
  let currentRegion: string | null = null

  for (const row of rows) {
    if (row.fg_enable === 0) {
      const rawName = row.sta_name.replace(/^AREA\s+/i, '')
      currentRegion = convertToTitleCase(rawName)
      result[currentRegion] = []
    } else if (currentRegion !== null && row.fg_enable === 1) {
      result[currentRegion].push({
        id: row.sta_id,
        name: convertToTitleCase(row.sta_name),
      })
    }
  }

  for (const [stationId, targetRegion] of Object.entries(REGION_OVERRIDES)) {
    for (const region of Object.keys(result)) {
      if (region === targetRegion) continue
      const idx = result[region].findIndex((s) => s.id === stationId)
      if (idx === -1) continue
      const [station] = result[region].splice(idx, 1)
      result[targetRegion].push(station)
      if (result[region].length === 0) delete result[region]
      break
    }
  }

  for (const region of Object.keys(result)) {
    result[region].sort((a, b) => a.name.localeCompare(b.name))
  }

  return result
}

async function getStations(): Promise<
  Record<string, { id: string; name: string }[]>
> {
  const response = await fetchWithRetry('stations', REVALIDATE_STATIONS)
  const json: KciStationResponse = await response.json()
  return parseRegionHeaders(json.data)
}

async function getFare(
  from: string,
  to: string
): Promise<{ from: string; to: string; fare: number; distance: string }[]> {
  const response = await fetchWithRetry(
    `fare?${new URLSearchParams({ stationfrom: from, stationto: to })}`,
    REVALIDATE_FARE
  )
  const json: KciFareResponse = await response.json()
  return json.data.map((row) => ({
    from: row.sta_code_from,
    to: row.sta_code_to,
    fare: row.fare,
    distance: row.distance,
  }))
}

async function getSchedules(
  stationId: string,
  timeFrom: string,
  timeTo: string = '23:59'
): Promise<KciScheduleRow[]> {
  let response: Response
  try {
    response = await fetchWithRetry(
      `schedules?${new URLSearchParams({ stationid: stationId, timefrom: timeFrom, timeto: timeTo })}`,
      REVALIDATE_SCHEDULES
    )
  } catch (error) {
    if (
      error instanceof UpstreamError &&
      error.message.includes('HTTP 404')
    ) {
      return []
    }
    throw error
  }
  const json: KciScheduleResponse = await response.json()
  return json.data.filter(
    (schedule) => !/TIDAK ANGKUT PENUMPANG/i.test(schedule.ka_name)
  )
}

async function getTrainSchedule(
  trainId: string
): Promise<KciTrainScheduleResponse['data']> {
  let response: Response
  try {
    response = await fetchWithRetry(
      `train-schedule?${new URLSearchParams({ trainid: trainId })}`,
      REVALIDATE_TRAIN_SCHEDULE
    )
  } catch (error) {
    if (
      error instanceof UpstreamError &&
      error.message.includes('HTTP 404')
    ) {
      return []
    }
    throw error
  }
  const json: KciTrainScheduleResponse = await response.json()
  return json.data
}

function computeTimeTo(timeFrom: string): string {
  const parts = timeFrom.split(':')
  if (parts.length < 2) return '23:59'

  const hh = Number(parts[0])
  const mm = Number(parts[1])

  if (isNaN(hh) || isNaN(mm)) return '23:59'

  const totalMinutes = hh * 60 + mm + ROUTE_SEARCH_WINDOW_HOURS * 60
  const maxMinutes = 23 * 60 + 59
  if (totalMinutes > maxMinutes) {
    return '23:59'
  }
  const newHh = Math.floor(totalMinutes / 60)
  const newMm = totalMinutes % 60
  return `${String(newHh).padStart(2, '0')}:${String(newMm).padStart(2, '0')}`
}

function guessLineId(kaName: string): string | null {
  if (/BOGOR|NAMBO/i.test(kaName)) return 'red'
  if (/RANGKASBITUNG/i.test(kaName)) return 'green'
  if (/CIKARANG/i.test(kaName)) return 'blue'
  if (/TANJUNG\s*PRIOK|PRIOK/i.test(kaName)) return 'pink'
  if (/TANGERANG/i.test(kaName)) return 'brown'
  return null
}

function parseMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

async function getRoute(
  from: string,
  to: string,
  timeFrom: string
): Promise<IKRLRouteResult> {
  const timeTo = computeTimeTo(timeFrom)
  const candidates = await getSchedules(from, timeFrom, timeTo)

  const graph = getLineGraph()
  const fromLines = graph.stations.get(from) ?? []
  const toLines = graph.stations.get(to) ?? []
  const sharedLineIds = fromLines.filter((l) => toLines.includes(l))

  let bestMatch: { result: IKRLRouteResult; diffMinutes: number } | null = null
  const refMinutes = parseMinutes(timeFrom)

  for (let i = 0; i < candidates.length; i++) {
    const { train_id, ka_name, color } = candidates[i]

    if (sharedLineIds.length > 0) {
      const candidateLine = guessLineId(ka_name)
      if (candidateLine && !sharedLineIds.includes(candidateLine)) continue
    }

    let stops
    try {
      stops = await getTrainSchedule(train_id)
    } catch (error) {
      if (error instanceof NoRouteFoundError) throw error
      continue
    }

    const fromIndex = stops.findIndex((s) => s.station_id === from)
    if (fromIndex === -1) continue

    const toIndex = stops.findIndex(
      (s, idx) => s.station_id === to && idx >= fromIndex
    )
    if (toIndex === -1) continue

    const departureMinutes = parseMinutes(stops[fromIndex].time_est)
    let diffMinutes = departureMinutes - refMinutes
    if (diffMinutes < 0) diffMinutes += 24 * 60

    if (!bestMatch || diffMinutes < bestMatch.diffMinutes) {
      bestMatch = {
        result: {
          train_id,
          train_name: ka_name,
          color,
          stops: stops.slice(fromIndex, toIndex + 1).map((s) => ({
            station_id: s.station_id,
            station_name: convertToTitleCase(s.station_name),
            time_est: convertTimeToHHMM(s.time_est),
          })),
        },
        diffMinutes,
      }
    }
  }

  if (!bestMatch) {
    throw new NoRouteFoundError(
      'No direct route found between the given stations'
    )
  }

  return bestMatch.result
}

async function tryRouteWithSameLineSplit(
  from: string,
  to: string,
  timeFrom: string
): Promise<IKRLRouteResult[]> {
  try {
    const leg = await getRoute(from, to, timeFrom)
    return [leg]
  } catch (error) {
    if (!(error instanceof NoRouteFoundError)) throw error
  }

  const graph = getLineGraph()
  const fromLines = graph.stations.get(from) ?? []
  const toLines = graph.stations.get(to) ?? []
  const sharedLines = fromLines.filter((l) => toLines.includes(l))

  if (sharedLines.length === 0) {
    throw new NoRouteFoundError(
      'No direct route found between the given stations'
    )
  }

  for (const lineId of sharedLines) {
    const stations = LINES[lineId].stations
    const fromIdx = stations.indexOf(from)
    const toIdx = stations.indexOf(to)

    if (fromIdx === -1 || toIdx === -1) continue

    const step = fromIdx < toIdx ? 1 : -1

    for (let mid = fromIdx + step; mid !== toIdx; mid += step) {
      const midStation = stations[mid]
      try {
        const leg1 = await getRoute(from, midStation, timeFrom)
        const arrivalTime = leg1.stops[leg1.stops.length - 1].time_est
        const leg2 = await getRoute(midStation, to, arrivalTime)
        return [leg1, leg2]
      } catch {
        continue
      }
    }
  }

  throw new NoRouteFoundError(
    'No direct route found between the given stations'
  )
}

async function getTransitRoute(
  from: string,
  to: string,
  timeFrom: string
): Promise<IKRLRouteResult[]> {
  if (from === to) {
    throw new NoRouteFoundError(
      'Origin and destination must be different stations'
    )
  }

  try {
    return await tryRouteWithSameLineSplit(from, to, timeFrom)
  } catch (error) {
    if (!(error instanceof NoRouteFoundError)) {
      throw error
    }
  }

  const forkPoint = getForkPoint(from, to)
  if (forkPoint) {
    const leg1 = await getRoute(from, forkPoint, timeFrom)
    const arrivalTime = leg1.stops[leg1.stops.length - 1].time_est
    const leg2 = await getRoute(forkPoint, to, arrivalTime)
    return [leg1, leg2]
  }

  const graph = getLineGraph()
  const transferStations = findTransferStations(
    from,
    to,
    graph,
    MAX_TRANSIT_LEGS
  )

  if (!transferStations) {
    throw new NoRouteFoundError(
      'These stations are not connected by any KRL line'
    )
  }

  const legs: IKRLRouteResult[] = []
  let previousArrivalTime = timeFrom
  let previousStation = from

  for (const transferStation of transferStations) {
    try {
      const subLegs = await tryRouteWithSameLineSplit(
        previousStation,
        transferStation,
        previousArrivalTime
      )
      legs.push(...subLegs)

      const lastLeg = subLegs[subLegs.length - 1]
      const lastStop = lastLeg.stops[lastLeg.stops.length - 1]
      previousArrivalTime = lastStop.time_est
      previousStation = transferStation
    } catch (error) {
      if (error instanceof NoRouteFoundError) {
        throw new NoRouteFoundError(
          'No trains currently connecting these stations at this time'
        )
      }
      throw error
    }
  }

  try {
    const finalLegs = await tryRouteWithSameLineSplit(
      previousStation,
      to,
      previousArrivalTime
    )
    legs.push(...finalLegs)
  } catch (error) {
    if (error instanceof NoRouteFoundError) {
      throw new NoRouteFoundError(
        'No trains currently connecting these stations at this time'
      )
    }
    throw error
  }

  return legs
}

export { getStations, getFare, getSchedules, getRoute, getTransitRoute, staleCache }
