export interface ParsedStationSchedule {
  slug: string
  weekday: string[]
  holiday: string[]
}

function extractTimes(block: string): string[] {
  const timeRe = /<small>(\d{2}:\d{2})<\/small>/g
  return [...block.matchAll(timeRe)].map((match) => match[1])
}

export function parseLrtScheduleHtml(html: string): ParsedStationSchedule[] {
  const paneRe = /<div class="tab-pane fade show[^"]*"\s*id="pills-([a-z0-9-]+)"/g
  const panes: { slug: string; index: number }[] = []
  let match: RegExpExecArray | null
  while ((match = paneRe.exec(html))) {
    panes.push({ slug: match[1], index: match.index })
  }

  return panes.map(({ slug, index }, i) => {
    const end = i + 1 < panes.length ? panes[i + 1].index : html.length
    const block = html.slice(index, end)

    const biasaIdx = block.indexOf('Hari Biasa')
    const liburIdx = block.indexOf('Hari Libur')
    if (biasaIdx === -1 || liburIdx === -1) {
      throw new Error(`Missing weekday/holiday section for station: ${slug}`)
    }

    return {
      slug,
      weekday: extractTimes(block.slice(biasaIdx, liburIdx)),
      holiday: extractTimes(block.slice(liburIdx)),
    }
  })
}
