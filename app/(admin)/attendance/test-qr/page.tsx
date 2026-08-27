'use client'

import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'

interface TestQRData {
  token: string
  student_code: string
  name: string
  expires_at: string | null
  ttl_seconds: number
  permanent?: boolean
}

export default function TestQRPage() {
  const [data, setData] = useState<TestQRData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/test-qr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Xatolik')
      }
      const json: TestQRData = await res.json()
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Xatolik yuz berdi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!data || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, data.token, {
      width: 300,
      margin: 2,
      color: { dark: '#0f172a', light: '#f8fafc' },
      errorCorrectionLevel: 'M'
    })
  }, [data])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium mb-3">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Sinov rejimi
          </div>
          <h1 className="text-2xl font-bold text-white">Test QR Kod</h1>
          <p className="text-slate-400 text-sm">Skanerni sinash uchun o&apos;quvchining doimiy QR kodini chiqaring</p>
        </div>

        <div className={`rounded-3xl border p-6 transition-all duration-500 ${data ? 'border-green-500/30 bg-slate-900/60' : 'border-slate-700/50 bg-slate-900/40'} backdrop-blur-sm`}>
          {!data ? (
            <div className="flex flex-col items-center gap-6 py-4">
              <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <p className="text-slate-500 text-sm text-center">QR kodni yaratish uchun quyidagi tugmani bosing</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="w-full text-center">
                <p className="text-white font-semibold text-lg">{data.name}</p>
                <p className="text-slate-400 text-sm">{data.student_code}</p>
              </div>

              <div className="relative rounded-2xl overflow-hidden p-2">
                <canvas ref={canvasRef} className="rounded-xl" />
              </div>

              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-400 font-mono text-sm font-semibold">Doimiy QR kod</span>
              </div>

              <div className="w-full bg-slate-950/60 rounded-xl p-3 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">QR matn (debug)</p>
                <p className="text-slate-300 font-mono text-xs break-all">{data.token}</p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-900/10 px-4 py-3 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <button
          onClick={generate}
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-semibold text-sm shadow-xl shadow-blue-900/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Yaratilmoqda...
            </>
          ) : data ? 'Qayta chiqarish' : 'QR Kod yaratish'}
        </button>

        <p className="text-center text-slate-600 text-xs">
          Bu sahifa faqat skanerni sinash uchun. Production da o&apos;chirish tavsiya etiladi.
        </p>
      </div>
    </div>
  )
}
