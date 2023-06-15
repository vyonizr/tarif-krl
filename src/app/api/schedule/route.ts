import { NextResponse } from 'next/server'

import { SCHEDULE_URL } from '../../constants'
import { IKRLScheduleResponse } from '../../types'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const stationid: string | null = searchParams.get('station_id')
    const timefrom: string | null = searchParams.get('time_from')
    if (stationid !== null && timefrom !== null) {
      const res = await fetch(
        `${SCHEDULE_URL}?` +
          new URLSearchParams({
            stationid,
            timefrom,
            timeto: '23:00',
          })
      )
      const resJSON: IKRLScheduleResponse = await res.json()
      resJSON.data = resJSON.data.filter((schedule) =>
        /^(?!.*TIDAK ANGKUT PENUMPANG).*$/i.test(schedule.ka_name)
      )
      return NextResponse.json(resJSON)
    } else {
      throw new Error('station_id or time_from is null')
    }
  } catch (err) {
    return NextResponse.json({ error: 'failed to load data' })
  }
}
