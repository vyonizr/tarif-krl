import Balancer from 'react-wrap-balancer'
import Link from 'next/link'

import { IStationState } from '../types'
import TrainRouteForm from './TrainRouteForm'
import { getStations } from '@/lib/krl/adapter'

export default async function Home({
  searchParams,
}: {
  searchParams: { from?: string; to?: string }
}) {
  const stations: IStationState = await getStations()

  return (
    <main className="w-full max-w-[380px] p-4">
      <Link href="/" className="mb-4 block text-center text-sm">
        <span>← Kembali ke halaman utama</span>
      </Link>
      <h1 className="text-center text-3xl font-bold">
        <Balancer>Jadwal KRL</Balancer>
      </h1>
      <TrainRouteForm
        stations={stations}
        initialFrom={searchParams.from}
        initialTo={searchParams.to}
      />
    </main>
  )
}
