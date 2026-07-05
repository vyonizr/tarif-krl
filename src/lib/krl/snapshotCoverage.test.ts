/// <reference types="jest" />

import * as fs from 'node:fs'
import * as path from 'node:path'

function collectFiles(baseDir: string, dir: string, result: string[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory()) {
      collectFiles(baseDir, path.join(dir, entry.name), result)
    } else if (entry.name.endsWith('.json')) {
      result.push(path.relative(baseDir, path.join(dir, entry.name)))
    }
  }
}

describe('train snapshot coverage', () => {
  const scheduleSnapshotsDir = path.join(process.cwd(), 'data', 'schedule-snapshots')
  const trainSnapshotsDir = path.join(process.cwd(), 'data', 'train-snapshots')

  test('every train_id in schedule snapshots has a matching train-snapshot file', () => {
    const trainIds = new Set<string>()

    const scheduleFiles = fs
      .readdirSync(scheduleSnapshotsDir)
      .filter((f) => f.endsWith('.json'))

    for (const file of scheduleFiles) {
      const raw = fs.readFileSync(path.join(scheduleSnapshotsDir, file), 'utf8')
      const parsed = JSON.parse(raw)
      for (const row of parsed.data) {
        if (row.train_id) {
          trainIds.add(row.train_id)
        }
      }
    }

    const trainFiles: string[] = []
    collectFiles(trainSnapshotsDir, trainSnapshotsDir, trainFiles)

    const haveSnapshot = new Set<string>()
    for (const relativePath of trainFiles) {
      const trainId = relativePath.replace(/\\/g, '/').replace(/\.json$/, '')
      haveSnapshot.add(trainId)
    }

    const missing = [...trainIds].filter((id) => !haveSnapshot.has(id)).sort()
    expect(missing).toEqual([])
  })
})
