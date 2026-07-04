#!/usr/bin/env node
// Manually-triggered fallback refresh: fetches each KRL line terminus
// station's full-day schedule straight from KCI, commits any changes into
// data/schedule-snapshots/, and pushes that commit directly to main so the
// bundled fallback (src/lib/krl/snapshotStore.ts's getRepoScheduleSnapshot)
// redeploys with fresh data. Run with `npm run snapshot:refresh`.
//
// Deliberately talks to KCI directly (not this app's own API) — a fallback
// data source shouldn't depend on the very system it's a fallback for.

import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { KCI_BASE_URL, TERMINUS_STATIONS } from '../src/lib/krl/constants.ts'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SNAPSHOT_DIR = path.join(ROOT, 'data', 'schedule-snapshots')
const dryRun = process.argv.includes('--dry-run')

async function fetchStationSchedule(stationId) {
  const url =
    `${KCI_BASE_URL}/schedules?` +
    new URLSearchParams({ stationid: stationId, timefrom: '00:00', timeto: '23:59' })
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  return json.data.filter((row) => !/TIDAK ANGKUT PENUMPANG/i.test(row.ka_name))
}

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', ...opts })
}

async function main() {
  await mkdir(SNAPSHOT_DIR, { recursive: true })

  const changed = []
  for (const stationId of TERMINUS_STATIONS) {
    const filePath = path.join(SNAPSHOT_DIR, `${stationId}.json`)
    try {
      const data = await fetchStationSchedule(stationId)
      const existing = existsSync(filePath)
        ? JSON.parse(await readFile(filePath, 'utf8')).data
        : null

      if (existing && JSON.stringify(existing) === JSON.stringify(data)) {
        console.log(`[snapshot] ${stationId}: unchanged (${data.length} trains)`)
        continue
      }

      const body = JSON.stringify(
        { stationId, capturedAt: new Date().toISOString(), data },
        null,
        2
      )
      await writeFile(filePath, body + '\n')
      changed.push(stationId)
      console.log(`[snapshot] ${stationId}: updated (${data.length} trains)`)
    } catch (error) {
      console.error(`[snapshot] ${stationId}: FAILED — ${error.message}`)
    }
  }

  if (changed.length === 0) {
    console.log('No schedule changes — nothing to commit.')
    return
  }

  if (dryRun) {
    console.log(`--dry-run: would publish changes for ${changed.join(', ')}`)
    return
  }

  await publishToMain(changed)
}

async function publishToMain(changedStations) {
  console.log('Publishing snapshot changes to main...')
  const worktreeDir = path.join(ROOT, '.snapshot-refresh-worktree')

  run('git', ['fetch', 'origin', 'main'])
  run('git', ['worktree', 'add', '--detach', worktreeDir, 'origin/main'])

  try {
    const destDir = path.join(worktreeDir, 'data', 'schedule-snapshots')
    mkdirSync(destDir, { recursive: true })
    for (const stationId of changedStations) {
      await copyFile(path.join(SNAPSHOT_DIR, `${stationId}.json`), path.join(destDir, `${stationId}.json`))
    }

    run('git', ['add', 'data/schedule-snapshots'], { cwd: worktreeDir })

    const staged = run('git', ['diff', '--cached', '--name-only'], { cwd: worktreeDir }).trim()
    if (!staged) {
      console.log('main already matches these snapshots — nothing to push.')
      return
    }

    run(
      'git',
      ['commit', '-m', `Update terminus station schedule snapshots (${changedStations.join(', ')})`],
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
