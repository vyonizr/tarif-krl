import { KciScheduleRow } from './types'

interface Snapshot {
  data: KciScheduleRow[]
  capturedAt: string
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

export { getScheduleSnapshot, setScheduleSnapshot }
export type { Snapshot }
