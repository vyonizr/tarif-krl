import './globals.css'
import { Lexend_Deca } from 'next/font/google'
import Link from 'next/link'
import Script from 'next/script'
import pkg from '../../package.json'

const lexendDeca = Lexend_Deca({ subsets: ['latin'] })

export const metadata = {
  title: 'Jadwal dan Tarif KRL',
  description: 'Jadwal dan Tarif KRL',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        className={
          lexendDeca.className +
          ' ' +
          'flex min-h-screen flex-col justify-between'
        }
      >
        {children}
        <footer className="py-4 text-center text-xs text-slate-400">
          <p>
            &copy; 2023-{new Date().getFullYear()}{' '}
            <Link
              href="https://vyonizr.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-600"
            >
              vyonizr
            </Link>
            {' | '}
            <Link
              href="https://github.com/vyonizr/tarif-krl"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-600"
            >
              GitHub
            </Link>
          </p>
          <p className="mt-1">v{pkg.version}</p>
        </footer>
        <Script src="/fixVH.js" />
      </body>
    </html>
  )
}
