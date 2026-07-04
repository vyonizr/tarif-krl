import { NextResponse } from 'next/server'
import { getSchedules } from '@/lib/krl/adapter'
import { ok, fail } from '@/lib/krl/response'
import { UpstreamError } from '@/lib/krl/types'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const stationId = searchParams.get('station_id')
    const timeFrom = searchParams.get('time_from')
    const timeTo = searchParams.get('time_to') ?? '23:00'

    if (!stationId || !timeFrom) {
      return NextResponse.json(
        fail(400, 'Parameters "station_id" and "time_from" are required'),
        { status: 400 }
      )
    }

    const data = await getSchedules(stationId, timeFrom, timeTo)
    return NextResponse.json(ok(data))
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
