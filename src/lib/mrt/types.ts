export interface IMRTStation {
  id: number
  slug: string
  name: string
}

export type ApiEnvelope<T> =
  | { data: T; error: null }
  | { data: null; error: { status: number; message: string } }

export interface MrtDatumResponse {
  data: IMRTStation[]
}

export interface MrtRouteSchedule {
  start: string
  end: string
  weekdaysStart: string
  weekdaysEnd: string
  weekendsStart: string
  weekendsEnd: string
}

export interface MrtRouteFacility {
  [key: string]: unknown
}

export interface MrtRouteStationObject {
  schedule?: MrtRouteSchedule
  facility?: MrtRouteFacility
  building?: Record<string, unknown>
  maps?: string
  description?: string
}

export interface MrtRouteStation {
  id: number
  name: string
  object: MrtRouteStationObject
}

export interface MrtRouteIntegration {
  cost: number
  timeEstimation: string
}

export interface MrtRouteData {
  from: MrtRouteStation
  to: MrtRouteStation
  integration: MrtRouteIntegration
}

export interface MrtRouteResponse {
  success: boolean
  data: MrtRouteData
}

export interface IMrtFareScheduleResult {
  fare: number
  timeEstimation: number
  direction: { start: string; end: string }
  schedule: {
    weekdays: string[]
    weekends: string[]
  }
}
