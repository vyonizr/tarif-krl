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

export interface IMRTStop {
  id: number
  created_at: string
  order: number
  station_id: number
  stations: {
    id: number
    name: string
  }
  route_id: number
}

export interface IMRTStation {
  id: number
  name: string
  is_transit: boolean
  nid: string
}

export interface IOfficialMRTStation {
  nid: string
  title: string
  urutan: string
  isbig: string
  path: string
  catatan: any
  antarmodas: string
  peta_lokalitas: string
  jadwal_lb_biasa: any
  jadwal_lb_libur: any
  jadwal_hi_biasa: string
  jadwal_hi_libur: string
  banner: string
  retails: MRTStationRetail[]
  estimasi: MRTEstimation[]
  fasilitas: MRTFacility[]
}

export interface MRTStationRetail {
  nid: string
  title: string
  jenis_retail: string
  cover: string
  path: string
}

export interface MRTEstimation {
  stasiun_nid: string
  tarif: string
  waktu: string
}

export interface MRTFacility {
  nid: string
  title: string
  jenis_fasilitas: string
  cover: string
  path: string
}

export interface IMRTRoute {
  id: number
  name: string
}

export interface IFavoriteRoute {
  originStationId: string
  destinationStationId: string
  region: string
  savedAt: number
}
