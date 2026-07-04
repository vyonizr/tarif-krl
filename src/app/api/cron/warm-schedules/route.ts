import { NextResponse } from 'next/server'
import { getStations } from '@/lib/krl/adapter'
import {
  getScheduleSnapshot,
  setScheduleSnapshot,
  getTrainSnapshot,
  setTrainSnapshot,
} from '@/lib/krl/snapshotStore'
import { SNAPSHOT_FETCH_CONCURRENCY, KCI_BASE_URL } from '@/lib/krl/constants'
import { KciScheduleRow, KciTrainScheduleRow } from '@/lib/krl/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function fetchFromKci(path: string, timeoutMs = 10_000): Promise<Response> {
  const url = `${KCI_BASE_URL}/${path}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res
  } finally {
    clearTimeout(timeoutId)
  }
}

async function scrapeStationSchedule(stationId: string): Promise<KciScheduleRow[]> {
  const res = await fetchFromKci(
    `schedules?${new URLSearchParams({ stationid: stationId, timefrom: '00:00', timeto: '23:59' })}`
  )
  const json = await res.json()
  return (json.data as KciScheduleRow[]).filter(
    (row) => !/TIDAK ANGKUT PENUMPANG/i.test(row.ka_name)
  )
}

async function scrapeTrainSchedule(trainId: string): Promise<KciTrainScheduleRow[]> {
  const res = await fetchFromKci(
    `train-schedule?${new URLSearchParams({ trainid: trainId })}`
  )
  const json = await res.json()
  return json.data as KciTrainScheduleRow[]
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const results: Record<string, string> = { stations: 'pending', trains: 'pending' }

  // 1. Collect every station ID from the live KCI station list.
  let allStationIds: string[] = []
  try {
    const stations = await getStations()
    allStationIds = Object.values(stations).flat().map((s) => s.id)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    console.error(`[cron/warm-schedules] failed to get station list: ${message}`)
    return NextResponse.json({ error: `Failed to get station list: ${message}` }, { status: 502 })
  }

  // 2. Scrape every station's full-day schedule, write to Blob.
  const trainIds = new Set<string>()
  let stationOk = 0
  let stationFail = 0

  for (let i = 0; i < allStationIds.length; i += SNAPSHOT_FETCH_CONCURRENCY) {
    const batch = allStationIds.slice(i, i + SNAPSHOT_FETCH_CONCURRENCY)
    const batchResults = await Promise.allSettled(
      batch.map(async (stationId) => {
        const data = await scrapeStationSchedule(stationId)
        for (const row of data) trainIds.add(row.train_id)

        const previous = await getScheduleSnapshot(stationId)
        if (previous && previous.data.length !== data.length) {
          console.warn(
            `[cron/warm-schedules] schedule changed for ${stationId}: ${previous.data.length} -> ${data.length} trains`
          )
        }

        await setScheduleSnapshot(stationId, data)
        return stationId
      })
    )

    for (const [idx, result] of batchResults.entries()) {
      const stationId = batch[idx]
      if (result.status === 'fulfilled') {
        stationOk++
      } else {
        stationFail++
        console.error(`[cron/warm-schedules] station ${stationId} failed: ${result.reason?.message ?? result.reason}`)
      }
    }
  }

  results.stations = `ok=${stationOk} fail=${stationFail}`

  // 3. Scrape every unique train's stop sequence, write to Blob.
  const allTrainIds = [...trainIds]
  let trainOk = 0
  let trainFail = 0

  for (let i = 0; i < allTrainIds.length; i += SNAPSHOT_FETCH_CONCURRENCY) {
    const batch = allTrainIds.slice(i, i + SNAPSHOT_FETCH_CONCURRENCY)
    const batchResults = await Promise.allSettled(
      batch.map(async (trainId) => {
        const data = await scrapeTrainSchedule(trainId)
        await setTrainSnapshot(trainId, data)
        return trainId
      })
    )

    for (const [idx, result] of batchResults.entries()) {
      const trainId = batch[idx]
      if (result.status === 'fulfilled') {
        trainOk++
      } else {
        trainFail++
        console.error(`[cron/warm-schedules] train ${trainId} failed: ${result.reason?.message ?? result.reason}`)
      }
    }
  }

  results.trains = `ok=${trainOk} fail=${trainFail}`

  console.log(`[cron/warm-schedules] done: ${stationOk}/${allStationIds.length} stations, ${trainOk}/${allTrainIds.length} trains`)
  return NextResponse.json({ results })
}
