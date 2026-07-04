import { NextResponse } from 'next/server'
import { getStations } from '@/lib/krl/adapter'
import { ok, fail, dataSourceHeaders } from '@/lib/krl/response'
import { UpstreamError, FetchMeta } from '@/lib/krl/types'

export async function GET() {
  const meta: FetchMeta = { source: 'live' }
  try {
    const data = await getStations(meta)
    return NextResponse.json(ok(data), { headers: dataSourceHeaders(meta) })
  } catch (error) {
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
