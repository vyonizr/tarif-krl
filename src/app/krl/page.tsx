import Balancer from 'react-wrap-balancer'
import Link from 'next/link'

import { IStationState } from '../types'
import TrainRouteForm from './TrainRouteForm'
import { getStations } from '@/lib/krl/adapter'
import { UpstreamError } from '@/lib/krl/types'

export default async function Home({
  searchParams,
}: {
  searchParams: { from?: string; to?: string }
}) {
  let stations: IStationState
  let loadError: string | null = null

  try {
    stations = await getStations()
  } catch (error) {
    if (error instanceof UpstreamError) {
      loadError = error.message
    } else {
      loadError = 'An unexpected error occurred'
    }
    stations = {}
  }

  return (
    <main className="w-full max-w-[380px] p-4">
      <Link href="/" className="mb-4 block text-center text-sm">
        <span>← Kembali ke halaman utama</span>
      </Link>
      <h1 id="krl-page-header" className="text-center text-3xl font-bold">
        <Balancer>Jadwal KRL</Balancer>
      </h1>
      {loadError && (
        <p className="mb-4 rounded-md bg-red-50 p-3 text-center text-sm text-red-700">
          {loadError}. Silakan coba lagi nanti.
        </p>
      )}
      <TrainRouteForm
        stations={stations}
        initialFrom={searchParams.from}
        initialTo={searchParams.to}
      />
    </main>
  )
}
