'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, AlertCircle, RefreshCw, Upload, Image as ImageIcon, CheckCircle2 } from 'lucide-react'

type QrCameraProps = {
  active: boolean
  onDetect?: (text: string) => void
  onScan?: (text: string) => void
}

function emitOnce(
  lastValue: { current: string },
  lastAt: { current: number },
  text: string,
  onDetect: (text: string) => void,
) {
  const value = text.trim()
  if (!value) return
  const now = Date.now()
  if (value === lastValue.current && now - lastAt.current < 2000) return
  lastValue.current = value
  lastAt.current = now
  onDetect(value)
}

export default function QrCamera({ active, onDetect, onScan }: QrCameraProps) {
  const handleDetect = onDetect || onScan || (() => {})
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const onDetectRef = useRef(handleDetect)
  const lastValue = useRef('')
  const lastAt = useRef(0)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [noCameraFound, setNoCameraFound] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [fileScanLoading, setFileScanLoading] = useState(false)

  onDetectRef.current = handleDetect

  useEffect(() => {
    if (!active) {
      setIsInitializing(false)
      return
    }

    let isMounted = true
    let html5QrCode: any = null
    const readerElementId = 'qr-reader-viewport'

    const startScanner = async () => {
      setIsInitializing(true)
      setCameraError(null)
      setNoCameraFound(false)

      try {
        const { Html5Qrcode } = await import('html5-qrcode')

        if (!isMounted) return

        const el = document.getElementById(readerElementId)
        if (!el) return

        html5QrCode = new Html5Qrcode(readerElementId, {
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        })

        const qrCodeSuccessCallback = (decodedText: string) => {
          if (!isMounted) return
          emitOnce(lastValue, lastAt, decodedText, (val) => onDetectRef.current(val))
        }

        const qrCodeErrorCallback = () => {
          // Frame skip
        }

        const config = {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minDim = Math.min(viewfinderWidth, viewfinderHeight)
            return {
              width: Math.floor(minDim * 0.75),
              height: Math.floor(minDim * 0.75)
            }
          },
          aspectRatio: 1.0,
        }

        // Check for available cameras first
        let cameras: Array<{ id: string; label: string }> = []
        try {
          cameras = await Html5Qrcode.getCameras()
        } catch {
          // Ignored
        }

        if (cameras && cameras.length > 0) {
          // Use back camera if available, otherwise first available camera
          const backCamera = cameras.find(c => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('orqa') || c.label.toLowerCase().includes('rear'))
          const selectedId = backCamera ? backCamera.id : cameras[0].id

          await html5QrCode.start(
            selectedId,
            config,
            qrCodeSuccessCallback,
            qrCodeErrorCallback
          )
          if (isMounted) setIsInitializing(false)
          return
        }

        // Try direct generic camera access (works on standard laptops)
        try {
          await html5QrCode.start(
            { facingMode: 'user' },
            config,
            qrCodeSuccessCallback,
            qrCodeErrorCallback
          )
          if (isMounted) setIsInitializing(false)
          return
        } catch {
          // Fallback to environment
          await html5QrCode.start(
            { facingMode: 'environment' },
            config,
            qrCodeSuccessCallback,
            qrCodeErrorCallback
          )
          if (isMounted) setIsInitializing(false)
          return
        }

      } catch (err: any) {
        console.warn('Camera initialization error:', err)
        if (isMounted) {
          setIsInitializing(false)
          if (err.name === 'NotAllowedError' || err.message?.includes('Permission')) {
            setCameraError('Kameradan foydalanishga ruxsat berilmadi. Iltimos brauzeringiz manzili yonidagi qulf (ruxsat) belgisini bosib kameraga ruxsat bering.')
          } else if (err.name === 'NotFoundError' || err.message?.includes('Requested device not found') || err.message?.includes('topilmadi')) {
            setNoCameraFound(true)
            setCameraError('Ushbu qurilmada faol kamera topilmadi yoki kamera boshqa dastur tomonidan band.')
          } else {
            setCameraError('Kamerani ishga tushirib bo\'lmadi. Qurilmangizda kamera borligini va ruxsat berilganligini tekshiring.')
          }
        }
      }
    }

    startScanner()

    return () => {
      isMounted = false
      if (html5QrCode) {
        try {
          if (html5QrCode.isScanning) {
            html5QrCode.stop().then(() => {
              try {
                html5QrCode.clear()
              } catch {}
            }).catch(() => {})
          } else {
            html5QrCode.clear()
          }
        } catch (e) {
          console.warn('Cleanup error:', e)
        }
      }
    }
  }, [active])

  // Handle scanning an image file as QR code (fallback when no physical webcam is plugged in)
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileScanLoading(true)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr-file-scanner-temp')
      const result = await scanner.scanFile(file, true)
      if (result) {
        emitOnce(lastValue, lastAt, result, (val) => onDetectRef.current(val))
      }
    } catch (err) {
      alert('Rasmdan QR kodni aniqlab bo\'lmadi. Iltimos aniqroq rasm tanlang.')
    } finally {
      setFileScanLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div ref={containerRef} className="absolute inset-0 bg-slate-950 flex items-center justify-center overflow-hidden">
      {/* Hidden container for file-based scanner */}
      <div id="qr-file-scanner-temp" className="hidden" />

      {/* Viewport element for html5-qrcode video */}
      <div 
        id="qr-reader-viewport" 
        className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover [&_img]:hidden [&_#qr-shaded-region]:hidden" 
      />

      {/* Error or No Camera display */}
      {cameraError && (
        <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center z-30">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-3 shadow-inner">
            <Camera className="w-7 h-7" />
          </div>
          
          <h3 className="font-bold text-white text-base mb-1">
            {noCameraFound ? 'Kamera ulanmagan' : 'Kamera xatosi'}
          </h3>
          <p className="text-xs text-slate-300 max-w-xs leading-relaxed mb-5">
            {cameraError}
          </p>

          <div className="flex flex-col gap-2.5 w-full max-w-xs">
            {/* File Upload QR scan alternative */}
            <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all cursor-pointer shadow-lg shadow-blue-600/20 active:scale-95">
              <Upload className="w-4 h-4" />
              <span>{fileScanLoading ? 'Aniqlanmoqda...' : 'QR rasm yuklab skaner qilish'}</span>
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleFileScan}
                disabled={fileScanLoading}
              />
            </label>

            <button
              onClick={() => {
                setCameraError(null)
                setIsInitializing(true)
                window.location.reload()
              }}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Qayta urinish</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
