const HOURS = Array.from(
  { length: 24 },
  (_, index) => index.toString().padStart(2, '0') + ':00'
)

const MRT_BASE_FARE = 4000
const MRT_NEXT_STATION_FARE = 1000
const SAME_STATION_PENALTY_FARE = 3000

const CORSPROXY_IO_URL = 'https://corsproxy.io/?'

const MRT_BASE_OFFICIAL_URL = 'https://jakartamrt.co.id/id/val'
const MRT_STATIONS_OFFICIAL_URL = MRT_BASE_OFFICIAL_URL + '/stasiuns'
const CORS_MRT_STATIONS_OFFICIAL_URL =
  CORSPROXY_IO_URL + encodeURIComponent(MRT_STATIONS_OFFICIAL_URL)

export {
  HOURS,
  MRT_BASE_FARE,
  MRT_NEXT_STATION_FARE,
  SAME_STATION_PENALTY_FARE,
  CORS_MRT_STATIONS_OFFICIAL_URL,
}
