import {
  KCI_BASE_URL,
  REVALIDATE_STATIONS,
  REVALIDATE_FARE,
  UPSTREAM_TIMEOUT_MS,
  UPSTREAM_RETRY_TIMEOUT_MS,
  UPSTREAM_RETRY_COUNT,
  ROUTE_SEARCH_WINDOW_HOURS,
  MAX_TRANSIT_LEGS,
} from './constants'
import {
  KciStationResponse,
  KciStationRow,
  KciFareResponse,
  KciScheduleRow,
  KciTrainScheduleResponse,
  IKRLRouteStop,
  IKRLRouteResult,
  UpstreamError,
  NoRouteFoundError,
  OnHop,
  FetchMeta,
  DataSource,
} from './types'
import { getLineGraph, findTransferStations, getForkPoint, hasSharedLine, LINES } from './topology'
import { convertToTitleCase, convertTimeToHHMM } from '@/app/utils'
import {
  getRepoScheduleSnapshot,
  getRepoTrainScheduleSnapshot,
} from './snapshotStore'

const RetryableHttpError = class extends Error {}

const SOURCE_RANK: Record<DataSource, number> = {
  live: 0,
  'repo-snapshot': 1,
}

function markSource(meta: FetchMeta | undefined, source: DataSource, capturedAt?: string): void {
  if (!meta) return
  if (SOURCE_RANK[source] >= SOURCE_RANK[meta.source]) {
    meta.source = source
    if (capturedAt !== undefined) {
      meta.capturedAt = capturedAt
    }
  }
}

function logUpstream(fields: Record<string, unknown>): void {
  if (process.env.NODE_ENV === 'production') return
  console.log(JSON.stringify({ tag: 'upstream-fetch', ...fields }))
}

async function fetchWithRetry(
  path: string,
  revalidate: number,
  meta?: FetchMeta
): Promise<Response> {
  const url = `${KCI_BASE_URL}/${path}`
  const maxAttempts = UPSTREAM_RETRY_COUNT + 1

  for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex++) {
    const timeoutMs = attemptIndex === 0 ? UPSTREAM_TIMEOUT_MS : UPSTREAM_RETRY_TIMEOUT_MS
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    const startedAt = Date.now()

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        next: { revalidate },
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        logUpstream({
          path, attempt: attemptIndex, timeoutMs, ms: Date.now() - startedAt,
          outcome: 'http-error', status: response.status,
        })
        if (response.status >= 500 || response.status === 429) {
          throw new RetryableHttpError()
        }
        throw new UpstreamError(
          502,
          `Upstream returned HTTP ${response.status}`
        )
      }

      logUpstream({
        path, attempt: attemptIndex, timeoutMs, ms: Date.now() - startedAt,
        outcome: 'success',
      })
      markSource(meta, 'live')

      return response
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof UpstreamError) throw error

      const willRetry = attemptIndex !== maxAttempts - 1

      if (!(error instanceof RetryableHttpError)) {
        logUpstream({
          path, attempt: attemptIndex, timeoutMs, ms: Date.now() - startedAt,
          outcome: controller.signal.aborted ? 'timeout' : 'network-error',
          willRetry,
        })
      }

      if (!willRetry) {
        throw new UpstreamError(502, 'Upstream KRL API unavailable')
      }
    }
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

async function getStations(
  meta?: FetchMeta
): Promise<Record<string, { id: string; name: string }[]>> {
  const response = await fetchWithRetry('stations', REVALIDATE_STATIONS, meta)
  const json: KciStationResponse = await response.json()
  return parseRegionHeaders(json.data)
}

async function getFare(
  from: string,
  to: string,
  meta?: FetchMeta
): Promise<{ from: string; to: string; fare: number; distance: string }[]> {
  const response = await fetchWithRetry(
    `fare?${new URLSearchParams({ stationfrom: from, stationto: to })}`,
    REVALIDATE_FARE,
    meta
  )
  const json: KciFareResponse = await response.json()
  return json.data.map((row) => ({
    from: row.sta_code_from,
    to: row.sta_code_to,
    fare: row.fare,
    distance: row.distance,
  }))
}

function parseMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

function filterSchedules(
  rows: KciScheduleRow[],
  timeFrom: string,
  timeTo: string
): KciScheduleRow[] {
  const fromMinutes = parseMinutes(timeFrom)
  const toMinutes = parseMinutes(timeTo)
  return rows.filter((row) => {
    if (/TIDAK ANGKUT PENUMPANG/i.test(row.ka_name)) return false
    const minutes = parseMinutes(row.time_est)
    return minutes >= fromMinutes && minutes <= toMinutes
  })
}

async function getSchedules(
  stationId: string,
  timeFrom: string,
  timeTo: string = '23:59',
  meta?: FetchMeta
): Promise<KciScheduleRow[]> {
  const repoSnapshot = await getRepoScheduleSnapshot(stationId)
  if (repoSnapshot) {
    markSource(meta, 'repo-snapshot', repoSnapshot.capturedAt)
    return filterSchedules(repoSnapshot.data, timeFrom, timeTo)
  }

  return []
}

async function getTrainSchedule(
  trainId: string,
  meta?: FetchMeta
): Promise<KciTrainScheduleResponse['data']> {
  const repoSnapshot = await getRepoTrainScheduleSnapshot(trainId)
  if (repoSnapshot) {
    markSource(meta, 'repo-snapshot', repoSnapshot.capturedAt)
    return repoSnapshot.data
  }

  return []
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

async function getRoute(
  from: string,
  to: string,
  timeFrom: string,
  meta?: FetchMeta
): Promise<IKRLRouteResult> {
  const timeTo = computeTimeTo(timeFrom)
  const candidates = await getSchedules(from, timeFrom, timeTo, meta)

  const graph = getLineGraph()
  const fromLines = graph.stations.get(from) ?? []
  const toLines = graph.stations.get(to) ?? []
  const sharedLineIds = fromLines.filter((l) => toLines.includes(l))

  let bestMatch: { result: IKRLRouteResult; diffMinutes: number } | null = null
  const refMinutes = parseMinutes(timeFrom)

  for (const { train_id, ka_name, color } of candidates) {
    if (sharedLineIds.length > 0) {
      const candidateLine = guessLineId(ka_name)
      if (candidateLine && !sharedLineIds.includes(candidateLine)) continue
    }

    let stops
    try {
      stops = await getTrainSchedule(train_id, meta)
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
  timeFrom: string,
  meta?: FetchMeta
): Promise<IKRLRouteResult[]> {
  try {
    const leg = await getRoute(from, to, timeFrom, meta)
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
        const leg1 = await getRoute(from, midStation, timeFrom, meta)
        const arrivalTime = leg1.stops[leg1.stops.length - 1].time_est
        const leg2 = await getRoute(midStation, to, arrivalTime, meta)
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

async function runHop(
  hopFrom: string,
  hopTo: string,
  timeFrom: string,
  useSplit: boolean,
  meta?: FetchMeta
): Promise<IKRLRouteResult[]> {
  if (useSplit) {
    return tryRouteWithSameLineSplit(hopFrom, hopTo, timeFrom, meta)
  }
  const leg = await getRoute(hopFrom, hopTo, timeFrom, meta)
  return [leg]
}

async function getTransitRoute(
  from: string,
  to: string,
  timeFrom: string,
  onHop?: OnHop,
  meta?: FetchMeta
): Promise<IKRLRouteResult[]> {
  if (from === to) {
    throw new NoRouteFoundError(
      'Origin and destination must be different stations'
    )
  }

  const forkPoint = getForkPoint(from, to)
  const graph = getLineGraph()

  if (forkPoint || hasSharedLine(from, to, graph)) {
    try {
      const legs = await tryRouteWithSameLineSplit(from, to, timeFrom, meta)
      onHop?.({ index: 0, total: 1, from, to, time: timeFrom }, { ok: true, legs })
      return legs
    } catch (error) {
      if (!(error instanceof NoRouteFoundError)) {
        throw error
      }
    }
  }

  let waypoints: string[]
  let useSplit: boolean

  if (forkPoint) {
    waypoints = [from, forkPoint, to]
    useSplit = false
  } else {
    const transferStations = findTransferStations(
      from,
      to,
      graph,
      MAX_TRANSIT_LEGS
    )

    if (!transferStations) {
      const message = 'These stations are not connected by any KRL line'
      if (!onHop) throw new NoRouteFoundError(message)
      onHop(
        { index: 0, total: 0, from, to, time: timeFrom },
        { ok: false, error: { status: 404, message } }
      )
      return []
    }

    waypoints = [from, ...transferStations, to]
    useSplit = true
  }

  const total = waypoints.length - 1

  const legs: IKRLRouteResult[] = []
  let currentTime = timeFrom
  let blocked = false

  for (let i = 0; i < total; i++) {
    const hop = { index: i, total, from: waypoints[i], to: waypoints[i + 1], time: currentTime }

    if (blocked) {
      onHop!(hop, {
        ok: false,
        error: {
          status: 404,
          message: 'No trains currently connecting these stations at this time',
        },
        blocked: true,
      })
      continue
    }

    try {
      const hopLegs = await runHop(waypoints[i], waypoints[i + 1], currentTime, useSplit, meta)
      legs.push(...hopLegs)
      const lastLeg = hopLegs[hopLegs.length - 1]
      currentTime = lastLeg.stops[lastLeg.stops.length - 1].time_est
      onHop?.(hop, { ok: true, legs: hopLegs })
    } catch (error) {
      if (!(error instanceof NoRouteFoundError)) {
        if (!onHop) throw error
        const upstream = error instanceof UpstreamError
        onHop(hop, {
          ok: false,
          error: {
            status: upstream ? (error as UpstreamError).status : 500,
            message: upstream ? error.message : 'Internal server error',
          },
        })
        blocked = true
        continue
      }

      const message = useSplit
        ? 'No trains currently connecting these stations at this time'
        : error.message

      if (!onHop) throw new NoRouteFoundError(message)

      onHop(hop, { ok: false, error: { status: 404, message } })
      blocked = true
    }
  }

  if (legs.length === 0 && !onHop) {
    throw new NoRouteFoundError(
      'No trains currently connecting these stations at this time'
    )
  }

  return legs
}

export {
  getStations,
  getFare,
  getSchedules,
  getTrainSchedule,
  getRoute,
  getTransitRoute,
  tryRouteWithSameLineSplit,
}
