import { NextResponse } from 'next/server'
import { IMRTStop } from '../../../types'

const headers = new Headers()
headers.set('Content-Type', 'application/json')
headers.set('apikey', process.env.NEXT_PUBLIC_SUPABASE_KEY || '')
headers.set(
  'Authorization',
  `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_KEY}` || ''
)

export async function GET() {
  try {
    const response = await fetch(
      process.env.SUPABASE_URL +
        '/stations?' +
        new URLSearchParams({
          select: 'id,name,is_transit',
          order: 'name.asc',
        }),
      { headers }
    )

    const responseJSON = await response.json()
    return NextResponse.json({ stations: responseJSON }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ error: err }, { status: 500 })
  }
}
