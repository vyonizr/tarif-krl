#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseLrtScheduleHtml } from '../src/lib/lrt/htmlParser.ts'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SNAPSHOT_DIR = path.join(ROOT, 'data', 'lrt-schedule-snapshots')
const SCHEDULE_URL = 'https://lrtjabodebek.kai.id/jadwal-keberangkatan'

async function main() {
  await mkdir(SNAPSHOT_DIR, { recursive: true })

  console.log('[lrt-snapshot] fetching schedule page...')
  const res = await fetch(SCHEDULE_URL, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) {
    console.error(`[lrt-snapshot] failed to fetch: HTTP ${res.status}`)
    process.exitCode = 1
    return
  }
  const html = await res.text()

  const stations = parseLrtScheduleHtml(html)
  console.log(`[lrt-snapshot] ${stations.length} stations parsed`)

  let changedCount = 0
  for (const { slug, weekday, holiday } of stations) {
    const filePath = path.join(SNAPSHOT_DIR, `${slug}.json`)
    const existing = existsSync(filePath)
      ? JSON.parse(await readFile(filePath, 'utf8'))
      : null

    const unchanged =
      existing &&
      JSON.stringify(existing.weekday) === JSON.stringify(weekday) &&
      JSON.stringify(existing.holiday) === JSON.stringify(holiday)

    if (unchanged) {
      console.log(`[lrt-snapshot] ${slug}: unchanged`)
      continue
    }

    const body = JSON.stringify(
      { stationId: slug, capturedAt: new Date().toISOString(), weekday, holiday },
      null,
      2
    )
    await writeFile(filePath, body + '\n')
    changedCount++
    console.log(
      `[lrt-snapshot] ${slug}: updated (${weekday.length} weekday, ${holiday.length} holiday)`
    )
  }

  console.log(
    changedCount === 0
      ? 'No schedule changes.'
      : `Done. ${changedCount} station snapshot(s) updated.`
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
