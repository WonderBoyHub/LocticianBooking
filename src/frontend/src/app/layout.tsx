import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/styles/globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'JLI Loctician - Professional Dreadlock Services',
    template: '%s | JLI Loctician',
  },
  description: 'Professional loctician booking system for dreadlock services in Denmark. Book your appointment with experienced dreadlock specialists.',
  keywords: ['loctician', 'dreadlocks', 'booking', 'hair services', 'Denmark', 'Copenhagen'],
  authors: [{ name: 'JLI Loctician' }],
  creator: 'JLI Loctician',
  openGraph: {
    type: 'website',
    locale: 'da_DK',
    url: 'https://jli-loctician.com',
    siteName: 'JLI Loctician',
    title: 'JLI Loctician - Professional Dreadlock Services',
    description: 'Professional loctician booking system for dreadlock services in Denmark.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JLI Loctician - Professional Dreadlock Services',
    description: 'Professional loctician booking system for dreadlock services in Denmark.',
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="da" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
