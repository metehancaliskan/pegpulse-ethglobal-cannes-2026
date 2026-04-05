import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { Providers } from './providers'
import PegPulseShell from '../App'

export const metadata: Metadata = {
  title: 'PegPulse',
  description: 'Stablecoin de-peg monitoring and onchain hedge execution.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <PegPulseShell>{children}</PegPulseShell>
        </Providers>
      </body>
    </html>
  )
}
