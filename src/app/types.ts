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
