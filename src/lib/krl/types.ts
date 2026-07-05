export interface KciStationRow {
  sta_id: string
  sta_name: string
  group_wil: number
  fg_enable: number
}

export interface KciStationResponse {
  status: number
  message: string
  data: KciStationRow[]
}

export interface KciFareRow {
  sta_code_from: string
  sta_name_from: string
  sta_code_to: string
  sta_name_to: string
  fare: number
  distance: string
}

export interface KciFareResponse {
  status: number
  data: KciFareRow[]
}

export interface KciScheduleRow {
  train_id: string
  ka_name: string
  route_name: string
  dest: string
  time_est: string
  color: string
  dest_time: string
}

export interface KciScheduleResponse {
  status: number
  data: KciScheduleRow[]
}

export type ApiEnvelope<T> =
  | { data: T; error: null }
  | { data: null; error: { status: number; message: string } }

export interface KciTrainScheduleRow {
  train_id: string
  ka_name: string
  station_id: string
  station_name: string
  time_est: string
  transit_station: boolean
  color: string
  transit: string
}

export interface KciTrainScheduleResponse {
  status: number
  data: KciTrainScheduleRow[]
}

export interface IKRLRouteStop {
  station_id: string
  station_name: string
  time_est: string
}

export interface IKRLRouteResult {
  train_id: string
  train_name: string
  color: string
  stops: IKRLRouteStop[]
}

export type DataSource = 'live' | 'repo-snapshot'

export interface FetchMeta {
  source: DataSource
  capturedAt?: string
}

export class UpstreamError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'UpstreamError'
    this.status = status
  }
}

export class NoRouteFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NoRouteFoundError'
  }
}

export type LegOutcome =
  | { ok: true; legs: IKRLRouteResult[] }
  | { ok: false; error: { status: number; message: string }; blocked?: boolean }

export interface HopInfo {
  index: number
  total: number
  from: string
  to: string
  time: string
}

export type OnHop = (hop: HopInfo, outcome: LegOutcome) => void
