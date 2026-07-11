import { mkdir, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { getRepoLrtScheduleSnapshot } from './snapshotStore'

const SNAPSHOT_DIR = path.join(process.cwd(), 'data', 'lrt-schedule-snapshots')
const FIXTURE_SLUG = '__test-fixture__'
const FIXTURE_PATH = path.join(SNAPSHOT_DIR, `${FIXTURE_SLUG}.json`)

describe('getRepoLrtScheduleSnapshot', () => {
  afterEach(async () => {
    await rm(FIXTURE_PATH, { force: true })
  })

  test('reads and parses a snapshot file for a known station', async () => {
    await mkdir(SNAPSHOT_DIR, { recursive: true })
    await writeFile(
      FIXTURE_PATH,
      JSON.stringify({
        stationId: FIXTURE_SLUG,
        capturedAt: '2026-01-01T00:00:00.000Z',
        weekday: ['05:00', '05:10'],
        holiday: ['06:00'],
      })
    )

    const result = await getRepoLrtScheduleSnapshot(FIXTURE_SLUG)

    expect(result).toEqual({
      stationId: FIXTURE_SLUG,
      capturedAt: '2026-01-01T00:00:00.000Z',
      weekday: ['05:00', '05:10'],
      holiday: ['06:00'],
    })
  })

  test('returns null when the snapshot file does not exist', async () => {
    const result = await getRepoLrtScheduleSnapshot('__does-not-exist__')
    expect(result).toBeNull()
  })
})
