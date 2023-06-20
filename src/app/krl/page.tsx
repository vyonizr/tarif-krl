import Balancer from 'react-wrap-balancer'

import { IKRLStationsResponse, IStationState } from '../types'
import TrainRouteForm from './TrainRouteForm'
import Link from 'next/link'

const REGION = {
  JABODETABEK: 'Jabodetabek',
  YOGYAKARTA: 'Yogyakarta',
}

async function getData(): Promise<IKRLStationsResponse> {
  // cannot use internal "/api" because this is React server component
  const res = await fetch('https://api-partner.krl.co.id/krlweb/v1/krl-station')
  if (!res.ok) {
    throw new Error('Failed to fetch data')
  }

  return res.json()
}

export default async function Home() {
  const data = await getData()

  let stations: IStationState = {
    Jabodetabek: [],
    Yogyakarta: [],
  }

  function regionParser(regionId: number) {
    switch (regionId) {
      case 0:
        return REGION.JABODETABEK
      case 6:
        return REGION.YOGYAKARTA
      default:
        return ''
    }
  }

  const updatedStations = { ...stations }
  if (data.data.length > 0) {
    data.data.forEach((station) => {
      if (/^(?!wil\d+$).*/i.test(station.sta_id)) {
        const region = regionParser(station.group_wil)
        if (region.length > 0) {
          updatedStations[region].push(station)
        }
      }
    })
  }

  stations = updatedStations

  return (
    <main className="w-full max-w-[380px] p-4">
      <Link href="/" className="mb-4 block text-center text-sm">
        <span>← Kembali ke halaman utama</span>
      </Link>
      <h1 className="text-center text-3xl font-bold">
        <Balancer>Tarif & Jadwal KRL {REGION.JABODETABEK}</Balancer>
      </h1>
      <TrainRouteForm stations={stations}></TrainRouteForm>
    </main>
  )
}
