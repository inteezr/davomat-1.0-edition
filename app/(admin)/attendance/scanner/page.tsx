'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ArrowLeft,
  UserCheck,
  Calendar
} from 'lucide-react'
import QrCamera from '@/components/qr-camera'

interface ScanSuccessData {
  first_name: string
  last_name: string
  student_code: string
  photo_url: string | null
  class_name: string | null
  checked_in_at: string
  status: 'present' | 'late'
}

type ScanStatus = 'idle' | 'scanning' | 'success' | 'error' | 'loading'

let sharedAudioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtxClass) {
        sharedAudioContext = new AudioCtxClass()
      }
    }
    if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume().catch(() => undefined)
    }
    return sharedAudioContext
  } catch {
    return null
  }
}

function playBeep(type: 'success' | 'error') {
  try {
    const audioCtx = getAudioContext()
    if (!audioCtx) return

    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)

    const now = audioCtx.currentTime
    if (type === 'success') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, now)
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.12)
      gain.gain.setValueAtTime(0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
      osc.start(now)
      osc.stop(now + 0.15)
    } else {
      osc.type = 'square'
      osc.frequency.setValueAtTime(320, now)
      osc.frequency.setValueAtTime(220, now + 0.08)
      gain.gain.setValueAtTime(0.25, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
      osc.start(now)
      osc.stop(now + 0.22)
    }
  } catch {
    // ignore audio failure
  }
}

export default function AttendanceScannerPage() {
  const router = useRouter()
  const { t, language } = useLanguage()
  const [scanStatus, setScanStatus] = useState<ScanStatus>('scanning')
  const [studentData, setStudentData] = useState<ScanSuccessData | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [cameraOn, setCameraOn] = useState(true)

  const busyRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current) {
          await containerRef.current.requestFullscreen()
        }
      } else {
        await document.exitFullscreen()
      }
    } catch (err) {
      console.error('Fullscreen toggle error:', err)
    }
  }

  const handleBack = async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen()
      } catch {
        // ignore
      }
    }
    router.push('/dashboard')
  }

  const handleQrDetected = async (rawValue: string) => {
    if (busyRef.current) return
    busyRef.current = true

    let token = rawValue.trim()

    // Support URL format: /api/qr/verify?token=XYZ
    if (token.includes('token=')) {
      const match = token.match(/token=([a-zA-Z0-9_\-\.]+)/)
      if (match) token = match[1]
    } else if (token.startsWith('http://') || token.startsWith('https://')) {
      const parts = token.split('/')
      token = parts[parts.length - 1]
    }

    setScanStatus('loading')
    setErrorMessage('')

    try {
      const res = await fetch('/api/attendance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        if (soundEnabled) playBeep('error')
        setErrorMessage(data.message || 'QR kodni tekshirib bo\'lmadi.')
        setScanStatus('error')
        setTimeout(() => {
          setScanStatus('scanning')
          busyRef.current = false
        }, 1300)
        return
      }

      if (soundEnabled) playBeep('success')
      setStudentData({
        first_name: data.student.first_name,
        last_name: data.student.last_name,
        student_code: data.student.student_code,
        photo_url: data.student.photo_url,
        class_name: data.class_name,
        checked_in_at: data.checked_in_at,
        status: data.status
      })
      setScanStatus('success')

      setTimeout(() => {
        setScanStatus('scanning')
        busyRef.current = false
      }, 1500)
    } catch {
      if (soundEnabled) playBeep('error')
      setErrorMessage('Internet ulanishida xatolik. Skaner onlayn ishlashi shart.')
      setScanStatus('error')
      setTimeout(() => {
        setScanStatus('scanning')
        busyRef.current = false
      }, 1300)
    }
  }

  const startCamera = () => {
    setStudentData(null)
    setErrorMessage('')
    setScanStatus('scanning')
    setCameraOn(true)
  }

  const stopCamera = () => {
    setCameraOn(false)
    setScanStatus('idle')
    busyRef.current = false
  }

  const getAvatarUrl = (student: ScanSuccessData) => {
    if (student.photo_url) return student.photo_url
    const seed = encodeURIComponent(`${student.first_name} ${student.last_name}`)
    return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=0284c7,16a34a,d97706,9333ea&textColor=ffffff&fontWeight=700&fontSize=42`
  }

  const locale = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'uz-UZ'

  return (
    <div 
      ref={containerRef}
      className={`min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col relative overflow-hidden select-none transition-colors duration-200 ${
        isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen' : ''
      }`}
    >
      {/* Top Header Bar */}
      <div className="z-20 px-6 py-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shadow-sm">
        {/* Left: Back button & Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-all active:scale-95 cursor-pointer border border-slate-200 dark:border-slate-700"
            title={t('back')}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('back')}</span>
          </button>

          <div className="hidden sm:block border-l border-slate-200 dark:border-slate-800 pl-3">
            <h1 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">{t('scanner')}</h1>
            <p className="text-[11px] text-slate-500 font-medium">Doimiy o&apos;quvchi QR kodlari orqali tezkor qayd etish</p>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-400'
                : 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs transition-all cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? t('exitKiosk') : t('kioskMode')}</span>
          </button>
        </div>
      </div>

      {/* Main Scanner Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative">
        <div className="w-full max-w-xl flex flex-col items-center gap-6">

          {/* Camera Frame Container */}
          <div className="w-full relative aspect-square max-w-[440px] rounded-3xl overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 transition-all duration-300">
            {cameraOn ? (
              <QrCamera
                onScan={handleQrDetected}
                active={cameraOn && !busyRef.current}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-slate-100 dark:bg-slate-900 text-slate-400">
                <p className="text-sm font-semibold">Kamera to&apos;xtatilgan</p>
                <button
                  onClick={startCamera}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-md cursor-pointer"
                >
                  Kamerani yoqish
                </button>
              </div>
            )}

            {/* Scanning Laser Beam */}
            {cameraOn && scanStatus === 'scanning' && (
              <div className="absolute inset-0 pointer-events-none flex flex-col justify-center items-center">
                <div className="w-64 h-64 border-2 border-dashed border-blue-400/60 rounded-3xl relative">
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_15px_#3b82f6] animate-pulse" 
                       style={{ animation: 'bounce 2.2s infinite ease-in-out' }}
                  />
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-xl" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-xl" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-xl" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-xl" />
                </div>
              </div>
            )}

            {/* Overlay: Loading */}
            {scanStatus === 'loading' && (
              <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-30 animate-in fade-in duration-150">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                <span className="font-bold text-base text-slate-800 dark:text-white">QR Tekshirilmoqda...</span>
              </div>
            )}

            {/* Overlay: Error */}
            {scanStatus === 'error' && (
              <div className="absolute inset-0 bg-rose-500/90 backdrop-blur-md flex flex-col items-center justify-center gap-3 z-30 text-white p-6 text-center animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center shadow-lg">
                  <XCircle className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-extrabold tracking-tight">Xatolik!</h3>
                <p className="text-sm text-rose-100 font-medium max-w-xs">{errorMessage}</p>
              </div>
            )}
          </div>

          {/* Prompt */}
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              {t('scanQr')}
            </p>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RECOGNITION CARD (POPUP WHEN DETECTED)                   */}
        {/* ========================================================= */}
        {studentData && scanStatus === 'success' && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden animate-in zoom-in-95 duration-200">
              
              {/* Status Header Badge */}
              <div className="w-full flex justify-center mb-6">
                <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-full font-black text-sm uppercase tracking-wider shadow-md ${
                  studentData.status === 'present'
                    ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                    : 'bg-amber-500 text-white shadow-amber-500/30'
                }`}>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{t('verified')} • {studentData.status === 'present' ? t('came') : t('late')}</span>
                </div>
              </div>

              {/* Top Photo / Avatar */}
              <div className="relative mb-5">
                <img
                  src={getAvatarUrl(studentData)}
                  alt={`${studentData.first_name} ${studentData.last_name}`}
                  className="w-32 h-32 md:w-36 md:h-36 rounded-3xl object-cover border-4 border-slate-100 dark:border-slate-800 shadow-xl bg-slate-100"
                />
                <div className="absolute -bottom-2 -right-2 w-9 h-9 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md">
                  <UserCheck className="w-5 h-5" />
                </div>
              </div>

              {/* Student Name */}
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-1">
                {studentData.last_name} {studentData.first_name}
              </h2>

              {/* Student Code Badge */}
              <p className="font-mono text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-xl mb-4">
                ID: {studentData.student_code}
              </p>

              {/* Class and Time info pill */}
              <div className="w-full grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex flex-col items-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('class')}</span>
                  <span className="font-extrabold text-base text-slate-800 dark:text-slate-100 mt-0.5">
                    {studentData.class_name || '—'}
                  </span>
                </div>

                <div className="flex flex-col items-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vaqt</span>
                  <div className="flex items-center gap-1.5 font-extrabold text-base text-slate-800 dark:text-slate-100 mt-0.5">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span>{new Date(studentData.checked_in_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  )
}
