import './globals.css'
import { Lexend_Deca } from 'next/font/google'

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
      <body className={lexendDeca.className}>{children}</body>
    </html>
  )
}
