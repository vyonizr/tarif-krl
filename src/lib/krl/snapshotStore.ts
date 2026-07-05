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

// Sole snapshot tier: a snapshot committed straight into the repo (see
// scripts/refresh-terminus-snapshots.mjs) and shipped with the deploy
// itself. next.config.js's outputFileTracingIncludes makes sure these files
// are actually bundled into the deployed function.
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
// list, since getSchedules's snapshot can't stand in for this: it only has each
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

export { getRepoScheduleSnapshot, getRepoTrainScheduleSnapshot }
export type { Snapshot, TrainSnapshot }
