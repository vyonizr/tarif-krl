#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { KCI_BASE_URL } from '../src/lib/krl/constants.ts'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SNAPSHOT_DIR = path.join(ROOT, 'data', 'schedule-snapshots')
const TRAIN_SNAPSHOT_DIR = path.join(ROOT, 'data', 'train-snapshots')
const FETCH_CONCURRENCY = 5
const INTER_BATCH_DELAY_MS = 300

async function fetchFromKci(path, timeoutMs = 10_000, retries = 3) {
  const url = `${KCI_BASE_URL}/${path}`
  let lastError
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After'), 10) || 5
        throw new Error(`HTTP 429 (Retry-After: ${retryAfter}s)`)
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    } catch (error) {
      lastError = error
      if (attempt < retries) {
        let delayMs = Math.min(1000 * 2 ** (attempt - 1) + Math.random() * 500, 16_000)
        const match = error.message?.match(/Retry-After: (\d+)s/)
        if (match) delayMs = Math.max(delayMs, parseInt(match[1], 10) * 1000)
        console.warn(`[fetch] ${path}: attempt ${attempt}/${retries} failed (${error.message}), retrying in ${(delayMs / 1000).toFixed(1)}s...`)
        await new Promise((r) => setTimeout(r, delayMs))
      }
    }
  }
  throw lastError
}

async function fetchAllStationIds() {
  const json = await fetchFromKci('stations')
  const ids = []
  for (const row of json.data) {
    if (row.fg_enable === 1) ids.push(row.sta_id)
  }
  return ids
}

async function fetchStationSchedule(stationId) {
  const json = await fetchFromKci(
    `schedules?${new URLSearchParams({ stationid: stationId, timefrom: '00:00', timeto: '23:59' })}`
  )
  return json.data.filter((row) => !/TIDAK ANGKUT PENUMPANG/i.test(row.ka_name))
}

async function fetchTrainSchedule(trainId) {
  const json = await fetchFromKci(
    `train-schedule?${new URLSearchParams({ trainid: trainId })}`
  )
  return json.data
}

async function main() {
  await mkdir(SNAPSHOT_DIR, { recursive: true })
  await mkdir(TRAIN_SNAPSHOT_DIR, { recursive: true })

  console.log('[snapshot] fetching station list...')
  let allStationIds
  try {
    allStationIds = await fetchAllStationIds()
    console.log(`[snapshot] ${allStationIds.length} stations found`)
  } catch (error) {
    console.error(`[snapshot] failed to get station list: ${error.message}`)
    process.exit(1)
  }

  const changedStations = []
  const trainIds = new Set()

  for (let i = 0; i < allStationIds.length; i += FETCH_CONCURRENCY) {
    const batch = allStationIds.slice(i, i + FETCH_CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(async (stationId) => {
        const filePath = path.join(SNAPSHOT_DIR, `${stationId}.json`)
        const data = await fetchStationSchedule(stationId)
        for (const row of data) trainIds.add(row.train_id)

        const existing = existsSync(filePath)
          ? JSON.parse(await readFile(filePath, 'utf8')).data
          : null

        if (existing && JSON.stringify(existing) === JSON.stringify(data)) {
          return { stationId, changed: false, count: data.length }
        }

        const body = JSON.stringify(
          { stationId, capturedAt: new Date().toISOString(), data },
          null,
          2
        )
        await writeFile(filePath, body + '\n')
        return { stationId, changed: true, count: data.length }
      })
    )

    for (const [idx, result] of results.entries()) {
      const stationId = batch[idx]
      if (result.status === 'fulfilled') {
        const { changed, count } = result.value
        if (changed) changedStations.push(stationId)
        console.log(`[snapshot] ${stationId}: ${changed ? 'updated' : 'unchanged'} (${count} trains)`)
      } else {
        console.error(`[snapshot] ${stationId}: FAILED — ${result.reason.message}`)
      }
    }
    if (i + FETCH_CONCURRENCY < allStationIds.length) {
      await new Promise((r) => setTimeout(r, INTER_BATCH_DELAY_MS))
    }
  }

  const changedTrains = await refreshTrainSnapshots(trainIds)

  if (changedStations.length === 0 && changedTrains.length === 0) {
    console.log('No schedule changes.')
    return
  }

  console.log(
    `Done. ${changedStations.length} station snapshot(s) updated, ` +
      `${changedTrains.length} train snapshot(s) updated.`
  )
  console.log('Snapshots written to data/schedule-snapshots/ and data/train-snapshots/ — commit and push manually.')
}

async function refreshTrainSnapshots(trainIds) {
  const changed = []
  const ids = [...trainIds].sort((a, b) => {
    const aMissing = !existsSync(path.join(TRAIN_SNAPSHOT_DIR, `${a}.json`))
    const bMissing = !existsSync(path.join(TRAIN_SNAPSHOT_DIR, `${b}.json`))
    return aMissing === bMissing ? 0 : aMissing ? -1 : 1
  })

  for (let i = 0; i < ids.length; i += FETCH_CONCURRENCY) {
    const batch = ids.slice(i, i + FETCH_CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(async (trainId) => {
        const filePath = path.join(TRAIN_SNAPSHOT_DIR, `${trainId}.json`)
        const data = await fetchTrainSchedule(trainId)
        const existing = existsSync(filePath)
          ? JSON.parse(await readFile(filePath, 'utf8')).data
          : null

        if (existing && JSON.stringify(existing) === JSON.stringify(data)) return null

        const body = JSON.stringify(
          { trainId, capturedAt: new Date().toISOString(), data },
          null,
          2
        )
        await writeFile(filePath, body + '\n')
        return trainId
      })
    )

    for (const [idx, result] of results.entries()) {
      const trainId = batch[idx]
      if (result.status === 'fulfilled') {
        if (result.value) changed.push(result.value)
      } else {
        console.error(`[snapshot] train ${trainId}: FAILED — ${result.reason.message}`)
      }
    }
    if (i + FETCH_CONCURRENCY < ids.length) {
      await new Promise((r) => setTimeout(r, INTER_BATCH_DELAY_MS))
    }
  }

  console.log(`[snapshot] trains: ${changed.length}/${ids.length} updated`)
  return changed
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
