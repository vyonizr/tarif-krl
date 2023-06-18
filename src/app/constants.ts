const HOURS = Array.from(
  { length: 24 },
  (_, index) => index.toString().padStart(2, '0') + ':00'
)

const MRT_BASE_FARE = 4000
const MRT_NEXT_STATION_FARE = 1000
const SAME_STATION_PENALTY_FARE = 3000

const BASE_URL = 'https://api-partner.krl.co.id/krlweb/v1'
const FARE_URL = BASE_URL + '/fare'
const SCHEDULE_URL = BASE_URL + '/schedule'

const MRT_BASE_OFFICIAL_URL = 'https://jakartamrt.co.id/id/val'
const MRT_STATIONS_OFFICIAL_URL = MRT_BASE_OFFICIAL_URL + '/stasiuns'

export {
  HOURS,
  FARE_URL,
  SCHEDULE_URL,
  MRT_BASE_FARE,
  MRT_NEXT_STATION_FARE,
  SAME_STATION_PENALTY_FARE,
  MRT_STATIONS_OFFICIAL_URL,
}
