import { IKRLStationsResponse, IStationState } from '../types'
import TrainRouteForm from './TrainRouteForm'
import Link from 'next/link'

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
        return 'Jabodetabek'
      case 6:
        return 'Yogyakarta'
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
    <main className='max-w-[380px] p-4 w-full'>
      <Link href='/' className='text-center block text-sm mb-4'>
        <span>← Kembali ke halaman utama</span>
      </Link>
      <h1 className='text-3xl font-bold text-center'>
        Tarif & Jadwal KRL Jabodetabek
      </h1>
      <TrainRouteForm stations={stations}></TrainRouteForm>
    </main>
  )
}
