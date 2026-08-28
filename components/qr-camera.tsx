'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Camera, AlertCircle, RefreshCw, Upload, SwitchCamera, FlipHorizontal } from 'lucide-react'

type QrCameraProps = {
  active: boolean
  paused?: boolean
  mirror?: boolean
  onDetect?: (text: string) => void
  onScan?: (text: string) => void
}

export default function QrCamera({ 
  active, 
  paused = false, 
  mirror = true, 
  onDetect, 
  onScan 
}: QrCameraProps) {
  const handleDetect = onDetect || onScan || (() => {})
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const onDetectRef = useRef(handleDetect)
  const pausedRef = useRef(paused)
  const lastScanned = useRef<{ code: string; time: number }>({ code: '', time: 0 })
  
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [noCameraFound, setNoCameraFound] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [fileScanLoading, setFileScanLoading] = useState(false)
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null)
  const [isMirrored, setIsMirrored] = useState(mirror)

  onDetectRef.current = handleDetect
  pausedRef.current = paused

  const switchCamera = useCallback(async () => {
    if (availableCameras.length < 2) return
    const currentIndex = availableCameras.findIndex(c => c.id === selectedCameraId)
    const nextIndex = (currentIndex + 1) % availableCameras.length
    setSelectedCameraId(availableCameras[nextIndex].id)
  }, [availableCameras, selectedCameraId])

  const toggleMirror = useCallback(() => {
    setIsMirrored(prev => !prev)
  }, [])

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
          if (pausedRef.current) return

          const text = decodedText.trim()
          if (!text) return

          const now = Date.now()
          // Prevent duplicate triggers within 1.5 seconds for the exact same code
          if (text === lastScanned.current.code && now - lastScanned.current.time < 1500) {
            return
          }

          lastScanned.current = { code: text, time: now }
          onDetectRef.current(text)
        }

        const qrCodeErrorCallback = () => {
          // Fast frame skip - normal during scanning
        }

        const config = {
          fps: 25, // High FPS for instant snappy detection
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minDim = Math.min(viewfinderWidth, viewfinderHeight)
            return {
              width: Math.floor(minDim * 0.8),
              height: Math.floor(minDim * 0.8)
            }
          },
          aspectRatio: 1.0,
        }

        let cameras: Array<{ id: string; label: string }> = []
        try {
          cameras = await Html5Qrcode.getCameras()
          if (isMounted && cameras && cameras.length > 0) {
            setAvailableCameras(cameras)
          }
        } catch {
          // Ignored
        }

        if (cameras && cameras.length > 0) {
          const backCamera = cameras.find(c =>
            c.label.toLowerCase().includes('back') ||
            c.label.toLowerCase().includes('orqa') ||
            c.label.toLowerCase().includes('rear') ||
            c.label.toLowerCase().includes('environment')
          )
          const targetId = selectedCameraId || (backCamera ? backCamera.id : cameras[0].id)
          if (!selectedCameraId) setSelectedCameraId(targetId)

          await html5QrCode.start(
            targetId,
            config,
            qrCodeSuccessCallback,
            qrCodeErrorCallback
          )
          if (isMounted) setIsInitializing(false)
          return
        }

        // Direct generic camera access
        try {
          await html5QrCode.start(
            { facingMode: 'environment' },
            config,
            qrCodeSuccessCallback,
            qrCodeErrorCallback
          )
          if (isMounted) setIsInitializing(false)
          return
        } catch {
          await html5QrCode.start(
            { facingMode: 'user' },
            config,
            qrCodeSuccessCallback,
            qrCodeErrorCallback
          )
          if (isMounted) setIsInitializing(false)
          return
        }

      } catch (err: any) {
        console.warn('Camera init error:', err)
        if (isMounted) {
          setIsInitializing(false)
          if (err.name === 'NotAllowedError' || err.message?.includes('Permission')) {
            setCameraError('Kameraga ruxsat berilmadi. Iltimos brauzeringizda kameraga ruxsat bering.')
          } else if (err.name === 'NotFoundError' || err.message?.includes('Requested device not found') || err.message?.includes('topilmadi')) {
            setNoCameraFound(true)
            setCameraError('Qurilmada kamera topilmadi yoki boshqa dastur tomonidan band.')
          } else {
            setCameraError('Kamerani ishga tushirib bo\'lmadi. Qurilmangizda kamera borligini tekshiring.')
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
              try { html5QrCode.clear() } catch {}
            }).catch(() => {})
          } else {
            html5QrCode.clear()
          }
        } catch (e) {
          console.warn('Cleanup error:', e)
        }
      }
    }
  }, [active, selectedCameraId])

  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileScanLoading(true)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr-file-scanner-temp')
      const result = await scanner.scanFile(file, true)
      if (result) {
        onDetectRef.current(result.trim())
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

      {/* Viewport element for html5-qrcode video (with optional horizontal mirror flip) */}
      <div 
        id="qr-reader-viewport" 
        className={`w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover [&_img]:hidden [&_#qr-shaded-region]:hidden ${
          isMirrored ? '[&_video]:-scale-x-100' : '[&_video]:scale-x-100'
        }`} 
      />

      {/* Camera Control Overlay (Flip Mirror + Switch Camera) */}
      {!cameraError && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {/* Flip / Reverse mirror button */}
          <button
            onClick={toggleMirror}
            className={`p-2.5 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg transition-all active:scale-95 cursor-pointer ${
              isMirrored 
                ? 'bg-blue-600/80 hover:bg-blue-600 text-white' 
                : 'bg-black/60 hover:bg-black/80 text-slate-300'
            }`}
            title={isMirrored ? "Oynani o'chirish (asl holat)" : "Oynani yoqish (o'ngdan chapga aylantirish)"}
          >
            <FlipHorizontal className="w-5 h-5" />
          </button>

          {/* Switch camera button if multiple cameras available */}
          {availableCameras.length > 1 && (
            <button
              onClick={switchCamera}
              className="p-2.5 rounded-2xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/10 shadow-lg transition-all active:scale-95 cursor-pointer"
              title="Kamerani almashtirish"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Initializing Spinner */}
      {isInitializing && (
        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-3 z-10 text-white">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-400">Kamera ishga tushmoqda...</span>
        </div>
      )}

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
