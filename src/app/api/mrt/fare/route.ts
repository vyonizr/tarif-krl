import { NextResponse } from 'next/server'
import { IMRTStop } from '../../../types'

import { MRT_BASE_FARE, MRT_NEXT_STATION_FARE } from '../../../constants'

function getNumberOfStops(
  departingStopOrder: number,
  destinationStopOrder: number
) {
  return Math.abs(departingStopOrder - destinationStopOrder)
}

function calculateFare(numberOfStops: number) {
  if (numberOfStops === 0) {
    return 0
  }
  let fare = MRT_BASE_FARE + (numberOfStops - 1) * MRT_NEXT_STATION_FARE
  return fare
}

function findSharedRoute(
  departingStops: IMRTStop[],
  destinationStops: IMRTStop[]
) {
  for (let i = 0; i < departingStops.length; i++) {
    for (let j = 0; j < destinationStops.length; j++) {
      if (departingStops[i].route_id === destinationStops[j].route_id) {
        return departingStops[i].route_id
      }
    }
  }

  return null
}

const headers = new Headers()
headers.set('Content-Type', 'application/json')
headers.set('apikey', process.env.NEXT_PUBLIC_SUPABASE_KEY || '')
headers.set(
  'Authorization',
  `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_KEY}` || ''
)

async function getStopsByStationId(stationId: number) {
  try {
    const response = await fetch(
      process.env.SUPABASE_URL +
        '/stops?' +
        new URLSearchParams({
          select: '*',
          station_id: `eq.${stationId}`,
        }),
      { headers }
    )

    const responseJSON = await response.json()
    return responseJSON
  } catch (error) {
    console.error(error)
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const departingStationId: string | null = searchParams.get('from')
    const destinationStationId: string | null = searchParams.get('to')
    if (departingStationId !== null && destinationStationId !== null) {
      const departingStops = await getStopsByStationId(
        parseInt(departingStationId)
      )
      const destinationStops = await getStopsByStationId(
        parseInt(destinationStationId)
      )

      const sharedRouteId = findSharedRoute(departingStops, destinationStops)

      const departingStop = departingStops.find(
        (stop: IMRTStop) => stop.route_id === sharedRouteId
      )
      const destinationStop = destinationStops.find(
        (stop: IMRTStop) => stop.route_id === sharedRouteId
      )

      const numberOfStops = getNumberOfStops(
        destinationStop.order,
        departingStop.order
      )

      const fare = calculateFare(numberOfStops)
      console.log({ departingStop, destinationStop, numberOfStops, fare })
      return NextResponse.json({ fare }, { status: 200 })
    }
  } catch (err) {
    return NextResponse.json({ error: err }, { status: 500 })
  }
}
