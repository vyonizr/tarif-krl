import {
  KCI_BASE_URL,
  REVALIDATE_STATIONS,
  REVALIDATE_FARE,
  REVALIDATE_SCHEDULES,
  UPSTREAM_TIMEOUT_MS,
  UPSTREAM_RETRY_TIMEOUT_MS,
  UPSTREAM_RETRY_COUNT,
  REVALIDATE_TRAIN_SCHEDULE,
  ROUTE_SEARCH_WINDOW_HOURS,
  MAX_TRANSIT_LEGS,
  GET_ROUTE_CONCURRENCY,
  ROUTE_EARLY_EXIT_MINUTES,
  BREAKER_FAILURE_THRESHOLD,
  BREAKER_WINDOW_MS,
  BREAKER_COOLDOWN_MS,
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
  OnHop,
  FetchMeta,
  DataSource,
} from './types'
import { getLineGraph, findTransferStations, getForkPoint, LINES } from './topology'
import { convertToTitleCase, convertTimeToHHMM } from '@/app/utils'
import { getScheduleSnapshot, getRepoScheduleSnapshot } from './snapshotStore'

const staleCache = new Map<string, { body: string; ts: number }>()
const inFlight = new Map<string, Promise<Response>>()

interface BreakerState {
  failures: number
  windowStart: number
  openUntil: number
}
const breakers = new Map<string, BreakerState>()

// One breaker per upstream endpoint class (path prefix before the query
// string), not per exact URL — a down `schedules` endpoint should trip for
// every station, not just the one that happened to fail first.
function breakerKey(path: string): string {
  return path.split('?')[0]
}

function isBreakerOpen(key: string): boolean {
  const breaker = breakers.get(key)
  return breaker ? Date.now() < breaker.openUntil : false
}

function recordFailure(key: string): void {
  const now = Date.now()
  const breaker = breakers.get(key)
  if (!breaker || now - breaker.windowStart > BREAKER_WINDOW_MS) {
    breakers.set(key, { failures: 1, windowStart: now, openUntil: 0 })
    return
  }
  breaker.failures += 1
  if (breaker.failures >= BREAKER_FAILURE_THRESHOLD) {
    breaker.openUntil = now + BREAKER_COOLDOWN_MS
  }
}

function recordSuccess(key: string): void {
  breakers.delete(key)
}

const SOURCE_RANK: Record<DataSource, number> = {
  live: 0,
  'stale-cache': 1,
  'blob-snapshot': 2,
  'repo-snapshot': 3,
}

function markSource(meta: FetchMeta | undefined, source: DataSource, capturedAt?: string): void {
  if (!meta) return
  if (SOURCE_RANK[source] > SOURCE_RANK[meta.source]) {
    meta.source = source
    meta.capturedAt = capturedAt
  }
}

async function fetchWithRetry(
  path: string,
  revalidate: number,
  meta?: FetchMeta
): Promise<Response> {
  const url = `${KCI_BASE_URL}/${path}`
  const key = breakerKey(path)

  function serveStale(): Response | null {
    const stale = staleCache.get(url)
    if (!stale) return null
    markSource(meta, 'stale-cache', new Date(stale.ts).toISOString())
    return new Response(stale.body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (isBreakerOpen(key)) {
    const stale = serveStale()
    if (stale) return stale
    throw new UpstreamError(502, 'Upstream KRL API unavailable')
  }

  // Concurrent callers for the same URL share one upstream fetch, but a
  // Response body can only be consumed once — hand each caller its own
  // clone rather than the shared instance.
  const existing = inFlight.get(url)
  if (existing) return (await existing).clone()

  const attempt = (async (): Promise<Response> => {
    const maxAttempts = UPSTREAM_RETRY_COUNT + 1

    for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex++) {
      const timeoutMs = attemptIndex === 0 ? UPSTREAM_TIMEOUT_MS : UPSTREAM_RETRY_TIMEOUT_MS
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          next: { revalidate },
        })
        clearTimeout(timeoutId)

        if (!response.ok) {
          if (response.status >= 500 || response.status === 429) {
            throw new Error('retryable upstream error')
          }
          recordFailure(key)
          throw new UpstreamError(
            502,
            `Upstream returned HTTP ${response.status}`
          )
        }

        recordSuccess(key)
        const cloned = response.clone()
        const body = await cloned.text()
        staleCache.set(url, { body, ts: Date.now() })
        markSource(meta, 'live')

        return response
      } catch (error) {
        clearTimeout(timeoutId)

        if (error instanceof UpstreamError) {
          const stale = serveStale()
          if (stale) return stale
          throw error
        }

        if (attemptIndex === maxAttempts - 1) {
          recordFailure(key)
          const stale = serveStale()
          if (stale) return stale
          throw new UpstreamError(502, 'Upstream KRL API unavailable')
        }
      }
    }

    const stale = serveStale()
    if (stale) return stale
    throw new UpstreamError(502, 'Upstream KRL API unavailable')
  })()

  inFlight.set(url, attempt)
  try {
    return (await attempt).clone()
  } finally {
    inFlight.delete(url)
  }
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

// Always fetches the full day for a station (coarse cache key) and filters
// to the caller's requested window in-process, so two callers asking for the
// same station a minute apart hit the same Next.js Data Cache entry instead
// of missing on the exact `timefrom` value.
async function getSchedules(
  stationId: string,
  timeFrom: string,
  timeTo: string = '23:59',
  meta?: FetchMeta
): Promise<KciScheduleRow[]> {
  let response: Response
  try {
    response = await fetchWithRetry(
      `schedules?${new URLSearchParams({ stationid: stationId, timefrom: '00:00', timeto: '23:59' })}`,
      REVALIDATE_SCHEDULES,
      meta
    )
  } catch (error) {
    if (
      error instanceof UpstreamError &&
      error.message.includes('HTTP 404')
    ) {
      return []
    }
    if (error instanceof UpstreamError) {
      const snapshot = await getScheduleSnapshot(stationId)
      if (snapshot) {
        markSource(meta, 'blob-snapshot', snapshot.capturedAt)
        return filterSchedules(snapshot.data, timeFrom, timeTo)
      }

      const repoSnapshot = await getRepoScheduleSnapshot(stationId)
      if (repoSnapshot) {
        markSource(meta, 'repo-snapshot', repoSnapshot.capturedAt)
        return filterSchedules(repoSnapshot.data, timeFrom, timeTo)
      }
    }
    throw error
  }
  const json: KciScheduleResponse = await response.json()
  return filterSchedules(json.data, timeFrom, timeTo)
}

async function getTrainSchedule(
  trainId: string,
  meta?: FetchMeta
): Promise<KciTrainScheduleResponse['data']> {
  let response: Response
  try {
    response = await fetchWithRetry(
      `train-schedule?${new URLSearchParams({ trainid: trainId })}`,
      REVALIDATE_TRAIN_SCHEDULE,
      meta
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

  for (let batchStart = 0; batchStart < candidates.length; batchStart += GET_ROUTE_CONCURRENCY) {
    const batch = candidates.slice(batchStart, batchStart + GET_ROUTE_CONCURRENCY)
    const batchResults = await Promise.allSettled(
      batch.map(async ({ train_id, ka_name, color }) => {
        if (sharedLineIds.length > 0) {
          const candidateLine = guessLineId(ka_name)
          if (candidateLine && !sharedLineIds.includes(candidateLine)) return null
        }

        let stops
        try {
          stops = await getTrainSchedule(train_id, meta)
        } catch (error) {
          if (error instanceof NoRouteFoundError) throw error
          return null
        }

        const fromIndex = stops.findIndex((s) => s.station_id === from)
        if (fromIndex === -1) return null

        const toIndex = stops.findIndex(
          (s, idx) => s.station_id === to && idx >= fromIndex
        )
        if (toIndex === -1) return null

        const departureMinutes = parseMinutes(stops[fromIndex].time_est)
        let diffMinutes = departureMinutes - refMinutes
        if (diffMinutes < 0) diffMinutes += 24 * 60

        return {
          train_id,
          train_name: ka_name,
          color,
          stops: stops.slice(fromIndex, toIndex + 1).map((s) => ({
            station_id: s.station_id,
            station_name: convertToTitleCase(s.station_name),
            time_est: convertTimeToHHMM(s.time_est),
          })),
          diffMinutes,
        }
      })
    )

    for (const settled of batchResults) {
      if (settled.status === 'rejected') {
        if (settled.reason instanceof NoRouteFoundError) throw settled.reason
        continue
      }
      const candidate = settled.value
      if (!candidate) continue

      if (!bestMatch || candidate.diffMinutes < bestMatch.diffMinutes) {
        bestMatch = {
          result: {
            train_id: candidate.train_id,
            train_name: candidate.train_name,
            color: candidate.color,
            stops: candidate.stops,
          },
          diffMinutes: candidate.diffMinutes,
        }
      }
    }

    if (bestMatch && bestMatch.diffMinutes <= ROUTE_EARLY_EXIT_MINUTES) break
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

// Without `onHop`, behaves exactly as before: any leg failure aborts the
// whole search. With `onHop`, a failed leg is reported via the callback and
// the search continues — but only while there's a real arrival time to chain
// the next leg from; once a leg fails, every leg after it is reported
// `blocked` rather than searched against a made-up timestamp.
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

  try {
    const legs = await tryRouteWithSameLineSplit(from, to, timeFrom, meta)
    onHop?.({ index: 0, total: 1, from, to, time: timeFrom }, { ok: true, legs })
    return legs
  } catch (error) {
    if (!(error instanceof NoRouteFoundError)) {
      throw error
    }
  }

  const forkPoint = getForkPoint(from, to)
  let waypoints: string[]
  let useSplit: boolean

  if (forkPoint) {
    waypoints = [from, forkPoint, to]
    useSplit = false
  } else {
    const graph = getLineGraph()
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
  getRoute,
  getTransitRoute,
  tryRouteWithSameLineSplit,
  staleCache,
  breakers,
}
