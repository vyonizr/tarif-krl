import './globals.css'
import { Lexend_Deca } from 'next/font/google'
import Link from 'next/link'
import Script from 'next/script'

const lexendDeca = Lexend_Deca({ subsets: ['latin'] })

export const metadata = {
  title: 'Tarif dan Jadwal KRL Jabodetabek',
  description: 'Tarif dan Jadwal KRL Jabodetabek',
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
        <footer>
          © {new Date().getFullYear()}{' '}
          <Link
            href="https://linktr.ee/vyonizr/"
            target="_blank"
            rel="noopener noreferrer"
          >
            vyonizr
          </Link>
          {' | '}
          <Link
            href="https://github.com/vyonizr/tarif-krl"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </Link>
        </footer>
        <Script src="/fixVH.js" />
      </body>
    </html>
  )
}
