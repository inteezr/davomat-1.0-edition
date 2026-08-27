import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kirish — Davomat 1.0',
  description: 'Davomat 1.0 tizimiga kirish',
}

/**
 * (auth) group layout — login sahifalari uchun
 * Admin panel layout'isiz, to'liq sahifa
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {children}
    </div>
  )
}
