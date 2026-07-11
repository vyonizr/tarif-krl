import { NextResponse } from 'next/server'
import { getJourney } from '@/lib/lrt/adapter'
import { ok, fail } from '@/lib/lrt/response'
import { LRT_STATIONS } from '@/lib/lrt/constants'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) {
    return NextResponse.json(
      fail(400, 'Parameters "from" and "to" are required'),
      { status: 400 }
    )
  }

  if (from === to) {
    return NextResponse.json(fail(400, 'Origin and destination must differ'), {
      status: 400,
    })
  }

  const knownSlugs = new Set(LRT_STATIONS.map((s) => s.slug))
  if (!knownSlugs.has(from) || !knownSlugs.has(to)) {
    return NextResponse.json(fail(400, 'Unknown "from" or "to" station'), {
      status: 400,
    })
  }

  try {
    const data = await getJourney(from, to)
    return NextResponse.json(ok(data))
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      fail(500, error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}
