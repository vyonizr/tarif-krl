import {
  MRT_MIDDLEWARE_BASE_URL,
  MRT_LINE_ORDER,
  SAME_STATION_PENALTY_FARE,
} from './constants'
import {
  IMRTStation,
  MrtDatumResponse,
  MrtRouteResponse,
  MrtRouteSchedule,
  IMrtFareScheduleResult,
} from './types'

const ORIGIN_HEADERS: Record<string, string> = {
  origin: 'https://jakartamrt.co.id',
  referer: 'https://jakartamrt.co.id/',
}

function parseSemicolonTimes(raw: string): string[] {
  if (!raw) return []
  return raw.split(';').map((t) => t.trim()).filter(Boolean)
}

function resolveDirection(
  fromId: number,
  toId: number
): 'start' | 'end' {
  const fromIndex = MRT_LINE_ORDER.indexOf(fromId)
  const toIndex = MRT_LINE_ORDER.indexOf(toId)
  if (fromIndex === -1 || toIndex === -1) {
    throw new Error(
      `Station not found in MRT_LINE_ORDER: from=${fromId} to=${toId}`
    )
  }
  return toIndex > fromIndex ? 'end' : 'start'
}

async function getStations(): Promise<IMRTStation[]> {
  const params = new URLSearchParams()
  params.append('fields[]', 'id')
  params.append('fields[]', 'slug')
  params.append('fields[]', 'name')
  params.append('filters[field][slug]', 'stasiun')
  params.append('locale', 'id')
  const url = `${MRT_MIDDLEWARE_BASE_URL}/datum?${params}`

  const response = await fetch(url, { headers: ORIGIN_HEADERS })

  if (!response.ok) {
    throw new Error(`Upstream returned HTTP ${response.status}`)
  }

  const json: MrtDatumResponse = await response.json()
  return json.data
}

async function getFareAndSchedule(
  from: number,
  to: number,
  datetime?: string
): Promise<IMrtFareScheduleResult> {
  const isoDatetime =
    datetime ?? new Date().toISOString().replace('Z', '')

  const url = `${MRT_MIDDLEWARE_BASE_URL}/route`
  const body = JSON.stringify({
    type: 'from',
    from: String(from),
    to: String(to),
    datetime: isoDatetime,
  })

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...ORIGIN_HEADERS,
      'Content-Type': 'application/json',
    },
    body,
  })

  if (!response.ok) {
    throw new Error(`Upstream returned HTTP ${response.status}`)
  }

  const json: MrtRouteResponse = await response.json()

  if (!json.success) {
    throw new Error('Upstream route request was not successful')
  }

  const { from: fromObj, to: toObj, integration } = json.data

  const directionKey = resolveDirection(from, to)
  const schedule: MrtRouteSchedule | undefined = fromObj.object.schedule

  let direction: { start: string; end: string }
  let weekdays: string[] = []
  let weekends: string[] = []

  let headingTowards: string

  if (schedule) {
    direction = { start: schedule.start, end: schedule.end }
    headingTowards =
      directionKey === 'end' ? schedule.end : schedule.start

    if (directionKey === 'end') {
      weekdays = parseSemicolonTimes(schedule.weekdaysEnd)
      weekends = parseSemicolonTimes(schedule.weekendsEnd)
    } else {
      weekdays = parseSemicolonTimes(schedule.weekdaysStart)
      weekends = parseSemicolonTimes(schedule.weekendsStart)
    }
  } else {
    const otherKey = directionKey === 'end' ? 'start' : 'end'
    direction = {
      start: otherKey === 'start' ? fromObj.name : toObj.name,
      end: otherKey === 'end' ? fromObj.name : toObj.name,
    }
    headingTowards =
      directionKey === 'end' ? direction.end : direction.start
  }

  return {
    fare: integration.cost,
    timeEstimation: parseInt(integration.timeEstimation, 10) || 0,
    direction,
    headingTowards,
    schedule: { weekdays, weekends },
  }
}

export { getStations, getFareAndSchedule, SAME_STATION_PENALTY_FARE }
