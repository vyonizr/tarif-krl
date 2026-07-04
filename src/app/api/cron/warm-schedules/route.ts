import { NextResponse } from 'next/server'
import { getSchedules } from '@/lib/krl/adapter'
import { getScheduleSnapshot, setScheduleSnapshot } from '@/lib/krl/snapshotStore'
import { TERMINUS_STATIONS } from '@/lib/krl/constants'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Daily snapshot of each KRL line's terminus stations, run at 00:01 WIB
// (see vercel.json's cron schedule, which is UTC). See
// docs/krl-upstream-reliability-sdd.md Strategy §6 for why: it warms the
// Blob-backed fallback used when a station's live fetch and in-memory
// stale-cache are both unavailable, and logs day-over-day schedule changes.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const results: Record<string, string> = {}

  for (const stationId of TERMINUS_STATIONS) {
    try {
      const previous = await getScheduleSnapshot(stationId)
      const data = await getSchedules(stationId, '00:00')

      if (previous && previous.data.length !== data.length) {
        console.warn(
          `[cron/warm-schedules] schedule changed for ${stationId}: ${previous.data.length} -> ${data.length} trains`
        )
      }

      await setScheduleSnapshot(stationId, data)
      results[stationId] = 'ok'
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      console.error(`[cron/warm-schedules] failed for ${stationId}: ${message}`)
      // Leave that station's snapshot untouched — yesterday's data stays
      // as its fallback rather than being wiped by a failed write.
      results[stationId] = `failed: ${message}`
    }
  }

  return NextResponse.json({ results })
}
