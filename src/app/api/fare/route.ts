import { NextResponse } from 'next/server'
import { FARE_URL } from '../../constants'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const stationfrom: string | null = searchParams.get('from')
    const stationto: string | null = searchParams.get('to')
    if (stationfrom !== null && stationto !== null) {
      const result = await fetch(
        `${FARE_URL}?` +
          new URLSearchParams({
            stationfrom,
            stationto,
          }),
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
      const data = await result.json()
      return NextResponse.json(data)
    } else {
      throw new Error('stationfrom or stationto is null')
    }
  } catch (err) {
    return NextResponse.json({ error: err }, { status: 500 })
  }
}
