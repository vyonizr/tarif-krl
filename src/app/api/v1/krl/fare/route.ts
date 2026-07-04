import { NextResponse } from 'next/server'
import { getFare } from '@/lib/krl/adapter'
import { ok, fail } from '@/lib/krl/response'
import { UpstreamError } from '@/lib/krl/types'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json(
        fail(400, 'Parameters "from" and "to" are required'),
        { status: 400 }
      )
    }

    const data = await getFare(from, to)
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
