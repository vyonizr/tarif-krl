import Balancer from 'react-wrap-balancer'
import Link from 'next/link'

import { getStations } from '@/lib/mrt/adapter'
import MRTRouteForm from './MRTRouteForm'

export default async function Home() {
  let stations = null as Awaited<ReturnType<typeof getStations>> | null
  let loadError = false

  try {
    stations = await getStations()
  } catch {
    loadError = true
  }

  return (
    <main className="w-full max-w-[380px] p-4">
      <Link href="/" className="mb-4 block text-center text-sm">
        <span>← Kembali ke halaman utama</span>
      </Link>
      <h1 className="text-center text-3xl font-bold">
        <Balancer>Jadwal MRT Jakarta</Balancer>
      </h1>
      {loadError && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          Data stasiun MRT sedang tidak bisa diakses. Silakan coba lagi nanti.
        </div>
      )}
      <MRTRouteForm stations={stations ?? []} />
    </main>
  )
}
