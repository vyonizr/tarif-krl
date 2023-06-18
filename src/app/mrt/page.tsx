import Balancer from 'react-wrap-balancer'
import Link from 'next/link'

import { IMRTStation, IOfficialMRTStation } from '../types'
import MRTRouteForm from './MRTRouteForm'
import { MRT_STATIONS_OFFICIAL_URL } from '../constants'

const headers = new Headers()
headers.set('Content-Type', 'application/json')
headers.set('apikey', process.env.NEXT_PUBLIC_SUPABASE_KEY || '')
headers.set(
  'Authorization',
  `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_KEY}` || ''
)

async function getData(): Promise<IMRTStation[]> {
  const res = await fetch(
    process.env.SUPABASE_URL +
      '/stations?' +
      new URLSearchParams({
        select: 'id,name,is_transit,nid',
        order: 'name.asc',
      }),
    { headers }
  )
  if (!res.ok) {
    throw new Error('Failed to fetch data')
  }

  return res.json()
}

async function getDataOfficial(): Promise<IOfficialMRTStation[]> {
  const res = await fetch(MRT_STATIONS_OFFICIAL_URL)
  if (!res.ok) {
    throw new Error('Failed to fetch data')
  }

  return res.json()
}

async function getRoutesData() {
  const res = await fetch(
    process.env.SUPABASE_URL +
      '/routes?' +
      new URLSearchParams({
        select: 'id,name',
        order: 'name.asc',
      }),
    { headers }
  )

  if (!res.ok) {
    throw new Error('Failed to fetch data')
  }

  return res.json()
}

export default async function Home() {
  const data = await getData()
  const dataMRT = await getDataOfficial()
  const routeData = await getRoutesData()

  return (
    <main className='max-w-[380px] p-4 w-full'>
      <Link href='/' className='text-center block text-sm mb-4'>
        <span>← Kembali ke halaman utama</span>
      </Link>
      <h1 className='text-3xl font-bold text-center'>
        <Balancer>Tarif & Jadwal MRT Jakarta</Balancer>
      </h1>
      <MRTRouteForm
        stations={data}
        officialMRTStations={dataMRT}
        routes={routeData}
      ></MRTRouteForm>
    </main>
  )
}
