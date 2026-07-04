#!/usr/bin/env node
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { KCI_BASE_URL } from '../src/lib/krl/constants.ts'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SNAPSHOT_DIR = path.join(ROOT, 'data', 'schedule-snapshots')
const TRAIN_SNAPSHOT_DIR = path.join(ROOT, 'data', 'train-snapshots')
const dryRun = process.argv.includes('--dry-run')
const FETCH_CONCURRENCY = 5

async function fetchFromKci(path, timeoutMs = 10_000) {
  const url = `${KCI_BASE_URL}/${path}`
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
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

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', ...opts })
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
  }

  const changedTrains = await refreshTrainSnapshots(trainIds)

  if (changedStations.length === 0 && changedTrains.length === 0) {
    console.log('No schedule changes — nothing to commit.')
    return
  }

  if (dryRun) {
    console.log(
      `--dry-run: would publish ${changedStations.length} station snapshot(s), ` +
        `${changedTrains.length} train snapshot(s)`
    )
    return
  }

  await publishToMain(changedStations, changedTrains)
}

async function refreshTrainSnapshots(trainIds) {
  const changed = []
  const ids = [...trainIds]

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
  }

  console.log(`[snapshot] trains: ${changed.length}/${ids.length} updated`)
  return changed
}

async function publishToMain(changedStations, changedTrains) {
  console.log('Publishing snapshot changes to main...')
  const worktreeDir = path.join(ROOT, '.snapshot-refresh-worktree')

  run('git', ['fetch', 'origin', 'main'])
  run('git', ['worktree', 'add', '--detach', worktreeDir, 'origin/main'])

  try {
    if (changedStations.length > 0) {
      const destDir = path.join(worktreeDir, 'data', 'schedule-snapshots')
      mkdirSync(destDir, { recursive: true })
      for (const stationId of changedStations) {
        await copyFile(path.join(SNAPSHOT_DIR, `${stationId}.json`), path.join(destDir, `${stationId}.json`))
      }
      run('git', ['add', 'data/schedule-snapshots'], { cwd: worktreeDir })
    }

    if (changedTrains.length > 0) {
      const destDir = path.join(worktreeDir, 'data', 'train-snapshots')
      mkdirSync(destDir, { recursive: true })
      for (const trainId of changedTrains) {
        await copyFile(path.join(TRAIN_SNAPSHOT_DIR, `${trainId}.json`), path.join(destDir, `${trainId}.json`))
      }
      run('git', ['add', 'data/train-snapshots'], { cwd: worktreeDir })
    }

    const staged = run('git', ['diff', '--cached', '--name-only'], { cwd: worktreeDir }).trim()
    if (!staged) {
      console.log('main already matches these snapshots — nothing to push.')
      return
    }

    run(
      'git',
      [
        'commit',
        '-m',
        `Update schedule snapshots (${changedStations.length} stations, ${changedTrains.length} trains)`,
      ],
      { cwd: worktreeDir }
    )
    run('git', ['push', 'origin', 'HEAD:main'], { cwd: worktreeDir })
    console.log('Pushed to main — Vercel should redeploy shortly.')
  } finally {
    run('git', ['worktree', 'remove', '--force', worktreeDir])
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
