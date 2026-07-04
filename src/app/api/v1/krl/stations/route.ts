import { NextResponse } from 'next/server'
import { getStations } from '@/lib/krl/adapter'
import { ok, fail } from '@/lib/krl/response'
import { UpstreamError } from '@/lib/krl/types'

export async function GET() {
  try {
    const data = await getStations()
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
