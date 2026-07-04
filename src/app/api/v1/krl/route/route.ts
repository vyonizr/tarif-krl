import { getTransitRoute } from '@/lib/krl/adapter'
import { getLineGraph } from '@/lib/krl/topology'
import { fail } from '@/lib/krl/response'
import { HopInfo, LegOutcome, FetchMeta } from '@/lib/krl/types'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function defaultTime(): string {
  const now = new Date()
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const hh = String(wib.getUTCHours()).padStart(2, '0')
  const mm = String(wib.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function isKnownStation(code: string): boolean {
  return getLineGraph().stations.has(code)
}

function sseChunk(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const time = searchParams.get('time') ?? defaultTime()

  if (!from || !to) {
    return NextResponse.json(
      fail(400, 'Parameters "from" and "to" are required'),
      { status: 400 }
    )
  }

  if (from === to) {
    return NextResponse.json(
      fail(400, 'Origin and destination must be different stations'),
      { status: 400 }
    )
  }

  if (!isKnownStation(from) || !isKnownStation(to)) {
    return NextResponse.json(
      fail(400, 'Station not recognized for route lookup'),
      { status: 400 }
    )
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let legsFound = 0
      let legsFailed = 0
      const meta: FetchMeta = { source: 'blob-snapshot' }

      const onHop = (hop: HopInfo, outcome: LegOutcome) => {
        if (outcome.ok) {
          legsFound += outcome.legs.length
          controller.enqueue(
            encoder.encode(sseChunk('leg', { ...hop, legs: outcome.legs }))
          )
        } else {
          legsFailed += 1
          controller.enqueue(
            encoder.encode(
              sseChunk('leg-error', {
                ...hop,
                error: outcome.error,
                blocked: outcome.blocked ?? false,
              })
            )
          )
        }
      }

      try {
        await getTransitRoute(from, to, time, onHop, meta)
      } catch (error) {
        legsFailed += 1
        const message =
          error instanceof Error ? error.message : 'Internal server error'
        controller.enqueue(
          encoder.encode(
            sseChunk('leg-error', {
              index: 0,
              total: 0,
              error: { status: 500, message },
              blocked: false,
            })
          )
        )
      }

      controller.enqueue(
        encoder.encode(
          sseChunk('done', { legsFound, legsFailed, dataSource: meta })
        )
      )
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
