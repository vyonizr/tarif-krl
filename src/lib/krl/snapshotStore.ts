import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { KciScheduleRow, KciTrainScheduleRow } from './types'

interface Snapshot {
  data: KciScheduleRow[]
  capturedAt: string
}

interface TrainSnapshot {
  data: KciTrainScheduleRow[]
  capturedAt: string
}

// Bottom-of-the-stack fallback: a snapshot committed straight into the repo
// (see scripts/refresh-terminus-snapshots.mjs) and shipped with the deploy
// itself, so it works even if BLOB_READ_WRITE_TOKEN was never configured or
// Blob is down. next.config.js's outputFileTracingIncludes makes sure these
// files are actually bundled into the deployed function.
async function getRepoScheduleSnapshot(stationId: string): Promise<Snapshot | null> {
  const filePath = path.join(process.cwd(), 'data', 'schedule-snapshots', `${stationId}.json`)
  try {
    const raw = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as { data: KciScheduleRow[]; capturedAt: string }
    return parsed
  } catch {
    return null
  }
}

// Same idea, but for a single train's full stop sequence (used to verify a
// candidate train reaches the hop's destination and to build its `stops`
// list — getSchedules's snapshot can't stand in for this, it only has each
// train's origin departure + final dest, not every intermediate stop).
async function getRepoTrainScheduleSnapshot(trainId: string): Promise<TrainSnapshot | null> {
  const filePath = path.join(process.cwd(), 'data', 'train-snapshots', `${trainId}.json`)
  try {
    const raw = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as TrainSnapshot
    return parsed
  } catch {
    return null
  }
}

// ponytail: in-memory fallback only persists for this process's lifetime —
// fine for local dev/tests; production relies on BLOB_READ_WRITE_TOKEN being
// set so snapshots actually survive across deploys/cold starts.
const memorySnapshots = new Map<string, Snapshot>()

function blobPath(stationId: string): string {
  return `schedule-snapshot/${stationId}.json`
}

function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

async function getScheduleSnapshot(stationId: string): Promise<Snapshot | null> {
  if (!blobConfigured()) {
    return memorySnapshots.get(stationId) ?? null
  }

  try {
    const { list } = await import('@vercel/blob')
    const { blobs } = await list({ prefix: blobPath(stationId), limit: 1 })
    const blob = blobs[0]
    if (!blob) return null

    const response = await fetch(blob.url, { cache: 'no-store' })
    if (!response.ok) return null

    const data: KciScheduleRow[] = await response.json()
    return { data, capturedAt: new Date(blob.uploadedAt).toISOString() }
  } catch (error) {
    console.error('[snapshotStore] blob read failed', error)
    return null
  }
}

async function setScheduleSnapshot(
  stationId: string,
  data: KciScheduleRow[]
): Promise<void> {
  if (!blobConfigured()) {
    memorySnapshots.set(stationId, { data, capturedAt: new Date().toISOString() })
    return
  }

  const { put } = await import('@vercel/blob')
  await put(blobPath(stationId), JSON.stringify(data), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  })
}

export {
  getScheduleSnapshot,
  setScheduleSnapshot,
  getRepoScheduleSnapshot,
  getRepoTrainScheduleSnapshot,
}
export type { Snapshot, TrainSnapshot }
