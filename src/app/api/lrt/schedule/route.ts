import { NextResponse } from 'next/server'
import { getSchedule } from '@/lib/lrt/adapter'
import { ok, fail } from '@/lib/lrt/response'
import { LRT_STATIONS } from '@/lib/lrt/constants'
import { LRTDayType } from '@/lib/lrt/types'

const VALID_DAY_TYPES: LRTDayType[] = ['weekday', 'holiday']

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const station = searchParams.get('station')
  const day = searchParams.get('day')

  if (!station || !day) {
    return NextResponse.json(
      fail(400, 'Parameters "station" and "day" are required'),
      { status: 400 }
    )
  }

  if (!VALID_DAY_TYPES.includes(day as LRTDayType)) {
    return NextResponse.json(
      fail(400, 'Parameter "day" must be "weekday" or "holiday"'),
      { status: 400 }
    )
  }

  if (!LRT_STATIONS.some((s) => s.slug === station)) {
    return NextResponse.json(fail(400, `Unknown station: ${station}`), { status: 400 })
  }

  try {
    const data = await getSchedule(station, day as LRTDayType)
    if (!data) {
      return NextResponse.json(
        fail(404, `No schedule snapshot for station: ${station}`),
        { status: 404 }
      )
    }
    return NextResponse.json(ok(data))
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      fail(500, error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}
