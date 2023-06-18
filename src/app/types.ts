export interface IKRLStationsResponse {
  status: number
  message: string
  data: KRLStation[]
}

export interface KRLStation {
  sta_id: string
  sta_name: string
  group_wil: number
  fg_enable: number
}

export interface IStationState {
  [key: string]: KRLStation[]
}

export interface IFareResponse {
  status: number
  data: IFare[]
}

export interface IFare {
  sta_code_from: string
  sta_name_from: string
  sta_code_to: string
  sta_name_to: string
  fare: number
  distance: string
}

export interface IKRLScheduleResponse {
  status: number
  data: IKRLSchedule[]
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