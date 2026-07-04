const KCI_BASE_URL =
  process.env.KCI_BASE_URL ?? 'https://kci.id/api/krl'

const REVALIDATE_STATIONS = 86400
const REVALIDATE_FARE = 3600
const REVALIDATE_SCHEDULES = 60

// The first request to kci.id in a process's lifetime pays for DNS + TLS
// handshake with no warm keep-alive connection to reuse — observed taking
// noticeably longer than a already-connected request's ~500ms round trip.
// GET_ROUTE_CONCURRENCY fires several of these at once on a cold start, so
// the timeout needs enough headroom to survive that one-time cost.
const UPSTREAM_TIMEOUT_MS = 4000
const UPSTREAM_RETRY_TIMEOUT_MS = 3000
const UPSTREAM_RETRY_COUNT = 1

const REVALIDATE_TRAIN_SCHEDULE = 60
const ROUTE_SEARCH_WINDOW_HOURS = 3
const MAX_TRANSIT_LEGS = 3
const GET_ROUTE_CONCURRENCY = 5

// Stop scanning candidate trains for a hop once one departs within this many
// minutes of the requested time — no need to exhaustively check every train
// in the 3-hour window once a good-enough match is already in hand.
const ROUTE_EARLY_EXIT_MINUTES = 5

// Circuit breaker: open after this many consecutive failures within the
// window, stay open for the cooldown, then allow one half-open probe.
// Must stay above GET_ROUTE_CONCURRENCY — otherwise one cold-start batch of
// concurrent candidate-train lookups (correlated timeouts, not a real
// outage) can trip it by itself and poison every route lookup for a minute.
const BREAKER_FAILURE_THRESHOLD = GET_ROUTE_CONCURRENCY + 3
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
  GET_ROUTE_CONCURRENCY,
  ROUTE_EARLY_EXIT_MINUTES,
  BREAKER_FAILURE_THRESHOLD,
  BREAKER_WINDOW_MS,
  BREAKER_COOLDOWN_MS,
  TERMINUS_STATIONS,
}
