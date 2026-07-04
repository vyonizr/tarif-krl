const KCI_BASE_URL =
  process.env.KCI_BASE_URL ?? 'https://kci.id/api/krl'

const REVALIDATE_STATIONS = 86400
const REVALIDATE_FARE = 3600
const REVALIDATE_SCHEDULES = 60

const UPSTREAM_TIMEOUT_MS = 2000
const UPSTREAM_RETRY_TIMEOUT_MS = 1500
const UPSTREAM_RETRY_COUNT = 1

const REVALIDATE_TRAIN_SCHEDULE = 60
const ROUTE_SEARCH_WINDOW_HOURS = 3
const MAX_TRANSIT_LEGS = 3
const ROUTE_RETRY_COUNT = 2
const GET_ROUTE_CONCURRENCY = 5

// Circuit breaker: open after this many consecutive failures within the
// window, stay open for the cooldown, then allow one half-open probe.
const BREAKER_FAILURE_THRESHOLD = 3
const BREAKER_WINDOW_MS = 30_000
const BREAKER_COOLDOWN_MS = 60_000

// Line-terminus stations warmed by the daily snapshot cron (see
// docs/krl-upstream-reliability-sdd.md, Strategy §6).
const TERMINUS_STATIONS = [
  'JAKK', 'NMO', 'BOO', // red (incl. Bogor/Nambo fork)
  'THB', 'RK', // green
  'CKR', 'POK', // blue
  'TPK', // pink (JAKK already listed)
  'MER', // merak (RK already listed)
  'TNG', 'DU', // brown
] as const

export {
  KCI_BASE_URL,
  REVALIDATE_STATIONS,
  REVALIDATE_FARE,
  REVALIDATE_SCHEDULES,
  UPSTREAM_TIMEOUT_MS,
  UPSTREAM_RETRY_TIMEOUT_MS,
  UPSTREAM_RETRY_COUNT,
  REVALIDATE_TRAIN_SCHEDULE,
  ROUTE_SEARCH_WINDOW_HOURS,
  MAX_TRANSIT_LEGS,
  ROUTE_RETRY_COUNT,
  GET_ROUTE_CONCURRENCY,
  BREAKER_FAILURE_THRESHOLD,
  BREAKER_WINDOW_MS,
  BREAKER_COOLDOWN_MS,
  TERMINUS_STATIONS,
}
