import { IKRLRouteResult } from "@/lib/krl/types"

export interface KRLStation {
  id: string
  name: string
}

// One planned hop of a multi-transit route, as streamed progressively by
// /api/v1/krl/route (see docs/krl-progressive-route-sdd.md). `from`/`to`/`time`
// on the error variant are the exact params needed to retry just that hop.
export type LegSlot =
  | { status: "pending" }
  | { status: "success"; from: string; to: string; legs: IKRLRouteResult[] }
  | {
      status: "error"
      from: string
      to: string
      time: string
      error: { status: number; message: string }
      blocked: boolean
    }

export interface IStationState {
  [key: string]: KRLStation[]
}

export interface IFareResponse {
  data: { from: string; to: string; fare: number; distance: string }[] | null
  error: { status: number; message: string } | null
}

export interface IKRLScheduleResponse {
  data: IKRLSchedule[] | null
  error: { status: number; message: string } | null
}

export interface IKRLSchedule {
  train_id: string
  ka_name: string
  route_name: string
  dest: string
  time_est: string
  color: string
  dest_time: string
}

export interface ILRTFavoriteRoute {
  originSlug: string
  destinationSlug: string
  savedAt: number
}

export interface IFavoriteRoute {
  originStationId: string
  destinationStationId: string
  region: string
  savedAt: number
}
