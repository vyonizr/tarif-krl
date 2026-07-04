import { NextResponse } from 'next/server'
import { getTransitRoute } from '@/lib/krl/adapter'
import { getLineGraph } from '@/lib/krl/topology'
import { ROUTE_RETRY_COUNT } from '@/lib/krl/constants'
import { ok, fail } from '@/lib/krl/response'
import { UpstreamError, NoRouteFoundError } from '@/lib/krl/types'

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

  let lastUpstreamError: UpstreamError | null = null

  for (let attempt = 0; attempt <= ROUTE_RETRY_COUNT; attempt++) {
    try {
      const legs = await getTransitRoute(from, to, time)
      return NextResponse.json(ok({ legs }))
    } catch (error) {
      if (error instanceof NoRouteFoundError) {
        return NextResponse.json(fail(404, error.message), { status: 404 })
      }
      if (error instanceof UpstreamError) {
        lastUpstreamError = error
        if (attempt < ROUTE_RETRY_COUNT) {
          continue
        }
      }
      if (!(error instanceof UpstreamError)) {
        console.error(error)
        return NextResponse.json(fail(500, 'Internal server error'), {
          status: 500,
        })
      }
    }
  }

  return NextResponse.json(
    fail(lastUpstreamError!.status, lastUpstreamError!.message),
    { status: lastUpstreamError!.status }
  )
}
