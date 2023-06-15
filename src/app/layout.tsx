import './globals.css'
import { Lexend_Deca } from 'next/font/google'
import Link from 'next/link'

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
    <html lang='en'>
      <body className={lexendDeca.className}>
        {children}
        <footer>
          © {new Date().getFullYear()}{' '}
          <Link
            href='https://linktr.ee/vyonizr/'
            target='_blank'
            rel='noopener noreferrer'
          >
            vyonizr
          </Link>
        </footer>
      </body>
    </html>
  )
}
