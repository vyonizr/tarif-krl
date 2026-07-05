const MRT_MIDDLEWARE_BASE_URL =
  process.env.MRT_MIDDLEWARE_BASE_URL ??
  'https://beweb-dev.jakartamrt.co.id/middleware/api'

const MRT_LINE_ORDER: number[] = [
  4, 33, 32, 34, 35, 36, 5, 37, 38, 39, 40, 41, 6,
]

const MRT_BASE_FARE = 4000
const MRT_NEXT_STATION_FARE = 1000
const SAME_STATION_PENALTY_FARE = 3000

export {
  MRT_MIDDLEWARE_BASE_URL,
  MRT_LINE_ORDER,
  MRT_BASE_FARE,
  MRT_NEXT_STATION_FARE,
  SAME_STATION_PENALTY_FARE,
}
