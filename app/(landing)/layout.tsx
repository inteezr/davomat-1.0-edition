import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Davomat Tizimi',
  description: 'QR kod orqali o\'quvchilar davomatini real vaqtda kuzating. Excel import, mobile app, avtomatik hisobotlar.',
  openGraph: {
    title: 'Davomat Tizimi',
    description: 'Avtomatlashtirilgan davomat tizimi',
    type: 'website',
  },
}

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
