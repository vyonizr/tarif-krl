import { NextResponse } from 'next/server'
import { getFareAndSchedule } from '@/lib/mrt/adapter'
import { ok, fail } from '@/lib/mrt/response'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const datetime = searchParams.get('datetime') || undefined

    if (!from || !to) {
      return NextResponse.json(
        fail(400, 'Parameters "from" and "to" are required'),
        { status: 400 }
      )
    }

    const data = await getFareAndSchedule(
      parseInt(from, 10),
      parseInt(to, 10),
      datetime
    )
    return NextResponse.json(ok(data))
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      fail(500, error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}
