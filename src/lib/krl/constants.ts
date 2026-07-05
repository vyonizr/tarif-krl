const KCI_BASE_URL =
  process.env.KCI_BASE_URL ?? 'https://kci.id/api/krl'

const REVALIDATE_STATIONS = 86400
const REVALIDATE_FARE = 3600

const UPSTREAM_TIMEOUT_MS = 4000
const UPSTREAM_RETRY_TIMEOUT_MS = 3000
const UPSTREAM_RETRY_COUNT = 1

const ROUTE_SEARCH_WINDOW_HOURS = 3
const MAX_TRANSIT_LEGS = 3

// Flat fare charged by KCI when tapping in and out at the same station
// without traveling (no route/legs apply in this case).
const SAME_STATION_FARE = 3000

// Concurrency for the daily snapshot cron when scraping station schedules
// and train stop sequences from KCI. Kept modest to avoid tripping KCI's
// own burst throttling (which was measured against real 429 responses).
const SNAPSHOT_FETCH_CONCURRENCY = 5

export {
  KCI_BASE_URL,
  REVALIDATE_STATIONS,
  REVALIDATE_FARE,
  UPSTREAM_TIMEOUT_MS,
  UPSTREAM_RETRY_TIMEOUT_MS,
  UPSTREAM_RETRY_COUNT,
  ROUTE_SEARCH_WINDOW_HOURS,
  MAX_TRANSIT_LEGS,
  SNAPSHOT_FETCH_CONCURRENCY,
  SAME_STATION_FARE,
}
