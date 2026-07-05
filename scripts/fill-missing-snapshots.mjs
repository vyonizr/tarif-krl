#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SNAPSHOT_DIR = path.join(ROOT, 'data', 'schedule-snapshots')
const TRAIN_SNAPSHOT_DIR = path.join(ROOT, 'data', 'train-snapshots')

function findMissingTrainIds() {
  const trainIds = new Set()
  for (const file of readdirSync(SNAPSHOT_DIR).filter((f) => f.endsWith('.json'))) {
    const parsed = JSON.parse(readFileSync(path.join(SNAPSHOT_DIR, file), 'utf8'))
    for (const row of parsed.data) if (row.train_id) trainIds.add(row.train_id)
  }

  const haveSnapshot = new Set(
    readdirSync(TRAIN_SNAPSHOT_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''))
  )

  return [...trainIds].filter((id) => !haveSnapshot.has(id)).sort()
}

const missing = findMissingTrainIds()
if (missing.length === 0) {
  console.log('[fill-missing] no missing train snapshots.')
  process.exit(0)
}

console.log(`[fill-missing] missing train snapshot(s): ${missing.join(', ')}`)
const result = spawnSync(
  process.execPath,
  [path.join(ROOT, 'scripts', 'refresh-terminus-snapshots.mjs'), `--train=${missing.join(',')}`],
  { stdio: 'inherit' }
)
process.exit(result.status ?? 1)
