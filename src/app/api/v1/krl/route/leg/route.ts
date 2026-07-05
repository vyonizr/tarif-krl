import { NextResponse } from 'next/server'
import { tryRouteWithSameLineSplit } from '@/lib/krl/adapter'
import { getLineGraph } from '@/lib/krl/topology'
import { ok, fail, dataSourceHeaders } from '@/lib/krl/response'
import { UpstreamError, NoRouteFoundError, FetchMeta } from '@/lib/krl/types'

export const dynamic = 'force-dynamic'

function isKnownStation(code: string): boolean {
  return getLineGraph().stations.has(code)
}

// Retries a single hop of a multi-transit route (see docs/krl-progressive-route-sdd.md).
// Takes the same from/to/time shape as the main route search, scoped to one leg only.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const time = searchParams.get('time')

  if (!from || !to || !time) {
    return NextResponse.json(
      fail(400, 'Parameters "from", "to" and "time" are required'),
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

  try {
    const meta: FetchMeta = { source: 'repo-snapshot' }
    const legs = await tryRouteWithSameLineSplit(from, to, time, meta)
    return NextResponse.json(ok({ legs }), { headers: dataSourceHeaders(meta) })
  } catch (error) {
    if (error instanceof NoRouteFoundError) {
      return NextResponse.json(fail(404, error.message), { status: 404 })
    }
    if (error instanceof UpstreamError) {
      return NextResponse.json(fail(error.status, error.message), {
        status: error.status,
      })
    }
    console.error(error)
    return NextResponse.json(fail(500, 'Internal server error'), {
      status: 500,
    })
  }
}
