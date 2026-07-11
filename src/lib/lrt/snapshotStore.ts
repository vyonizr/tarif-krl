import { readFile } from 'node:fs/promises'
import path from 'node:path'

export interface LrtScheduleSnapshot {
  stationId: string
  capturedAt: string
  weekday: string[]
  holiday: string[]
}

async function getRepoLrtScheduleSnapshot(
  slug: string
): Promise<LrtScheduleSnapshot | null> {
  const filePath = path.join(process.cwd(), 'data', 'lrt-schedule-snapshots', `${slug}.json`)
  try {
    const raw = await readFile(filePath, 'utf8')
    return JSON.parse(raw) as LrtScheduleSnapshot
  } catch {
    return null
  }
}

export { getRepoLrtScheduleSnapshot }
