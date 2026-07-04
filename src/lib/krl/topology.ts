interface LineInfo {
  name: string
  stations: readonly string[]
  branches?: Record<string, readonly string[]>
  forkPoint?: string
}

export const LINES: Record<string, LineInfo> = {
  red: {
    name: 'Lin Bogor/Nambo',
    stations: [
      'JAKK', 'JAY', 'MGB', 'SW', 'JUA', 'GDD', 'CKI', 'MRI', 'TEB', 'CW',
      'DRN', 'PSMB', 'PSM', 'TNT', 'LNA', 'UP', 'UI', 'POC', 'DPB', 'DP',
      'CTA', 'BJD', 'CLT', 'BOO', 'CBN', 'NMO',
    ],
    branches: {
      bogor: ['BJD', 'CLT', 'BOO'],
      nambo: ['CBN', 'NMO'],
    },
    forkPoint: 'CTA',
  },
  green: {
    name: 'Lin Rangkasbitung',
    stations: [
      'THB', 'PLM', 'KBY', 'PDJ', 'JMU', 'SDM', 'RU', 'SRP', 'CSK', 'CC',
      'PRP', 'CJT', 'DAR', 'TEJ', 'TGS', 'CKY', 'MJ', 'CTR', 'RK',
    ],
  },
  blue: {
    name: 'Lin Cikarang',
    stations: [
      'CKR', 'TLM', 'CIT', 'TB', 'BKST', 'BKS', 'KRI', 'CUK', 'KLDB', 'BUA',
      'KLD', 'JNG', 'MTR', 'MRI', 'SUD', 'KAT', 'THB', 'DU', 'AK', 'KPB',
      'RJW', 'KMO', 'PSE', 'GST', 'KMT', 'POK',
    ],
  },
  pink: {
    name: 'Lin Tanjung Priok',
    stations: ['JAKK', 'KPB', 'AC', 'TPK'],
  },
  merak: {
    name: 'Lin Lokal Merak',
    stations: [
      'RK', 'JBU', 'CT', 'CKL', 'WLT', 'SG', 'KRA', 'TOJB', 'CLG', 'KEN', 'MER',
    ],
  },
  brown: {
    name: 'Lin Tangerang',
    stations: [
      'TNG', 'THI', 'BPR', 'PI', 'KDS', 'RW', 'BOI', 'TKO', 'PSG', 'GGL',
      'DU',
    ],
  },
}

const LINE_EDGE_OVERRIDES: Record<string, string> = {
  'green|merak': 'RK',
}

type LineId = keyof typeof LINES

interface LineGraph {
  stations: Map<string, LineId[]>
  edges: Map<LineId, Map<LineId, string>>
}

function buildLineGraph(): LineGraph {
  const stations = new Map<string, LineId[]>()

  for (const [lineId, line] of Object.entries(LINES)) {
    for (const station of line.stations) {
      const existing = stations.get(station) ?? []
      if (!existing.includes(lineId as LineId)) {
        existing.push(lineId as LineId)
      }
      stations.set(station, existing)
    }
  }

  const sharedCount = new Map<string, string[]>()

  for (const [station, lineIds] of stations) {
    if (lineIds.length < 2) continue
    for (let i = 0; i < lineIds.length; i++) {
      for (let j = i + 1; j < lineIds.length; j++) {
        const a = lineIds[i]
        const b = lineIds[j]
        const key = [a, b].sort().join('|')
        if (!sharedCount.has(key)) sharedCount.set(key, [])
        sharedCount.get(key)!.push(station)
      }
    }
  }

  const edges = new Map<LineId, Map<LineId, string>>()

  for (const [key, sharedStations] of sharedCount) {
    const [a, b] = key.split('|') as [LineId, LineId]
    const station =
      LINE_EDGE_OVERRIDES[key] ??
      sharedStations[sharedStations.length - 1]

    if (!edges.has(a)) edges.set(a, new Map())
    if (!edges.has(b)) edges.set(b, new Map())
    edges.get(a)!.set(b, station)
    edges.get(b)!.set(a, station)

    if (sharedStations.length >= 2 && !LINE_EDGE_OVERRIDES[key]) {
      console.warn(
        `Line pair ${key} has ${sharedStations.length} shared stations: ${sharedStations.join(', ')} — consider adding an override`
      )
    }
  }

  return { stations, edges }
}

function findBranch(
  branches: Record<string, readonly string[]>,
  station: string
): string | null {
  for (const [name, stations] of Object.entries(branches)) {
    if (stations.includes(station)) return name
  }
  return null
}

function getForkPoint(from: string, to: string): string | null {
  for (const [, line] of Object.entries(LINES)) {
    if (!line.branches || !line.forkPoint) continue
    const fromBranch = findBranch(line.branches, from)
    const toBranch = findBranch(line.branches, to)
    if (fromBranch && toBranch && fromBranch !== toBranch) {
      return line.forkPoint
    }
  }
  return null
}

function hasSharedLine(from: string, to: string, graph: LineGraph): boolean {
  const fromLines = graph.stations.get(from)
  const toLines = graph.stations.get(to)
  if (!fromLines || !toLines) return false
  return fromLines.some((l) => toLines.includes(l))
}

function findTransferStations(
  from: string,
  to: string,
  graph: LineGraph,
  maxHops: number
): string[] | null {
  const fromLines = graph.stations.get(from)
  const toLines = graph.stations.get(to)
  if (!fromLines || !toLines) return null

  const targetLineSet = new Set(toLines)

  for (const fl of fromLines) {
    if (targetLineSet.has(fl)) return []
  }

  const queue: { line: LineId; path: string[] }[] = fromLines.map((l) => ({
    line: l,
    path: [],
  }))
  const visited = new Set<LineId>(fromLines)

  while (queue.length > 0) {
    const { line, path } = queue.shift()!

    if (path.length >= maxHops) continue

    const neighbors = graph.edges.get(line)
    if (!neighbors) continue

    for (const [nextLine, transferStation] of neighbors) {
      if (visited.has(nextLine)) continue
      visited.add(nextLine)

      const newPath = [...path, transferStation]

      if (targetLineSet.has(nextLine)) {
        return newPath
      }

      if (newPath.length < maxHops) {
        queue.push({ line: nextLine, path: newPath })
      }
    }
  }

  return null
}

const graph = buildLineGraph()

function getLineGraph(): LineGraph {
  return graph
}

export { getLineGraph, hasSharedLine, findTransferStations, getForkPoint }
export type { LineGraph }
