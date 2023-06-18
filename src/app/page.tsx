import Link from 'next/link'
import Image from 'next/image'
import KRLLogo from './assets/images/krl_logo.png'
import MRTLogo from './assets/images/mrt_logo.svg'

const NAVIGATIONS = [
  { name: 'Kereta Rel Listrik (KRL)', href: '/krl', logo: KRLLogo },
  { name: 'Mass Rapid Transit (MRT)', href: '/mrt', logo: MRTLogo },
]

export default async function Home() {
  return (
    <main className='max-w-[380px] p-4 w-full'>
      <h1 className='text-3xl font-bold text-center'>
        Pilih Moda Transportasi
      </h1>
      <div className='mt-4'>
        {NAVIGATIONS.map((nav) => (
          <Link
            href={nav.href}
            key={nav.name}
            className='no-underline hover:no-underline'
          >
            <button
              key={nav.name}
              className='mt-2 w-full grid grid-cols-[2rem_auto] gap-x-4 items-center justify-center bg-slate-200 lg:hover:bg-slate-300 rounded h-[3rem] transition-colors'
            >
              <Image src={nav.logo} alt={nav.name} className='w-8 h-8 inline' />
              <p>{nav.name}</p>
            </button>
          </Link>
        ))}
      </div>
    </main>
  )
}
