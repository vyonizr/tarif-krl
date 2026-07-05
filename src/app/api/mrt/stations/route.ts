import { NextResponse } from 'next/server'
import { getStations } from '@/lib/mrt/adapter'
import { ok, fail } from '@/lib/mrt/response'

export async function GET() {
  try {
    const data = await getStations()
    return NextResponse.json(ok(data))
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      fail(500, error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}
