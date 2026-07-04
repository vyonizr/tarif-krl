import Link from 'next/link'
import Image from 'next/image'
import KRLLogo from './assets/images/krl_logo.png'
import MRTLogo from './assets/images/mrt_logo.svg'

const NAVIGATIONS = [
  { name: 'Kereta Rel Listrik (KRL)', href: '/krl', logo: KRLLogo },
  // ponytail: MRT temporarily disabled for fixes, re-enable by restoring href '/mrt'
  { name: 'Mass Rapid Transit (MRT)', href: null, logo: MRTLogo },
]

export default async function Home() {
  return (
    <main className="w-full max-w-[380px] p-4">
      <h1 className="text-center text-3xl font-bold">
        Pilih Moda Transportasi
      </h1>
      <div className="mt-4">
        {NAVIGATIONS.map((nav) =>
          nav.href ? (
            <Link
              href={nav.href}
              key={nav.name}
              className="no-underline hover:no-underline"
            >
              <button className="mt-2 grid h-[3rem] w-full grid-cols-[2rem_auto] items-center justify-center gap-x-4 rounded bg-slate-200 transition-colors lg:hover:bg-slate-300">
                <Image src={nav.logo} alt={nav.name} className="h-8 inline w-8" />
                <p>{nav.name}</p>
              </button>
            </Link>
          ) : (
            <button
              key={nav.name}
              disabled
              className="mt-2 grid w-full grid-cols-[2rem_auto] items-center justify-center gap-x-4 rounded bg-slate-100 px-4 py-2.5 text-slate-400 cursor-not-allowed"
            >
              <Image src={nav.logo} alt={nav.name} className="h-8 inline w-8 opacity-50" />
              <div className="text-left leading-tight">
                <p>{nav.name}</p>
                <p className="text-xs text-slate-400">Segera Kembali</p>
              </div>
            </button>
          ),
        )}
      </div>
    </main>
  )
}
