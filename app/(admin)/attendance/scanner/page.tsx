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
  User,
  QrCode,
  Sparkles,
  School,
  IdCard,
  History,
  Check
} from 'lucide-react'
import QrCamera from '@/components/qr-camera'

interface ScanSuccessData {
  id?: string
  first_name: string
  last_name: string
  student_code: string
  photo_url: string | null
  class_name: string | null
  checked_in_at: string
  status: 'present' | 'late'
}

interface RecentScanItem extends ScanSuccessData {
  timeFormatted: string
}

type ScanStatus = 'idle' | 'scanning' | 'verifying' | 'success' | 'error'

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
      osc.frequency.setValueAtTime(980, now)
      osc.frequency.exponentialRampToValueAtTime(1800, now + 0.12)
      gain.gain.setValueAtTime(0.35, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
      osc.start(now)
      osc.stop(now + 0.15)
    } else {
      osc.type = 'square'
      osc.frequency.setValueAtTime(350, now)
      osc.frequency.setValueAtTime(200, now + 0.1)
      gain.gain.setValueAtTime(0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
      osc.start(now)
      osc.stop(now + 0.22)
    }
  } catch {
    // Audio context error ignore
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
  const [recentScans, setRecentScans] = useState<RecentScanItem[]>([])
  const [todayCount, setTodayCount] = useState(0)

  const busyRef = useRef(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
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

    setScanStatus('verifying')
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
        
        // Show error for 1.8s then resume camera scanning
        setTimeout(() => {
          setScanStatus('scanning')
          busyRef.current = false
        }, 1800)
        return
      }

      if (soundEnabled) playBeep('success')

      const successStudent: ScanSuccessData = {
        first_name: data.student.first_name,
        last_name: data.student.last_name,
        student_code: data.student.student_code,
        photo_url: data.student.photo_url,
        class_name: data.class_name,
        checked_in_at: data.checked_in_at,
        status: data.status
      }

      setStudentData(successStudent)
      setScanStatus('success')
      setTodayCount(prev => prev + 1)

      // Add to recent scans list
      const timeFmt = new Date(data.checked_in_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      setRecentScans(prev => [{ ...successStudent, timeFormatted: timeFmt }, ...prev.slice(0, 4)])

      // Display student details for exactly 2 seconds, then smoothly resume scanning
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setScanStatus('scanning')
        busyRef.current = false
      }, 2000)

    } catch {
      if (soundEnabled) playBeep('error')
      setErrorMessage('Server bilan aloqa xatosi. Qayta urinib ko\'ring.')
      setScanStatus('error')
      setTimeout(() => {
        setScanStatus('scanning')
        busyRef.current = false
      }, 1500)
    }
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
      className={`min-h-screen bg-slate-950 text-white flex flex-col relative overflow-hidden select-none ${
        isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen' : ''
      }`}
    >
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-10 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <header className="z-20 px-6 py-4 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80 flex justify-between items-center shrink-0">
        {/* Left: Back button & Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all active:scale-95 cursor-pointer border border-slate-700"
            title={t('back')}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('back')}</span>
          </button>

          <div className="border-l border-slate-800 pl-3 flex items-center gap-3">
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                <QrCode className="w-5 h-5 text-blue-400" />
                {t('scanner')}
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">Ultra-tezkor doimiy QR davomat tizimi</p>
            </div>

            {/* Today marked counter pill */}
            {todayCount > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold animate-in fade-in">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Bugun skanerlandi: {todayCount}
              </span>
            )}
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-400 shadow-sm'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title={soundEnabled ? 'Ovozni o\'chirish' : 'Ovozni yoqish'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-all cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? t('exitKiosk') : t('kioskMode')}</span>
          </button>
        </div>
      </header>

      {/* Main Grid: LEFT (Big Student Profile) + RIGHT (High-Tech Camera Viewport) */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 md:p-8 max-w-7xl w-full mx-auto items-center relative z-10 overflow-y-auto">
        
        {/* ========================================================= */}
        {/* LEFT COLUMN: BIG STUDENT DETAILS CARD (~55% width on LG) */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 flex flex-col justify-center h-full min-h-[460px]">
          {studentData && (scanStatus === 'success' || scanStatus === 'verifying') ? (
            <div className="w-full bg-slate-900/90 backdrop-blur-2xl border-2 border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between animate-in zoom-in-95 duration-200">
              
              {/* 2-second Progress Bar countdown on top */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-slate-800 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-[2000ms] ease-linear ${
                    studentData.status === 'present' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: scanStatus === 'success' ? '0%' : '100%' }}
                />
              </div>

              {/* Status Header Badge */}
              <div className="flex justify-between items-center mb-6">
                <div className={`inline-flex items-center gap-2.5 px-6 py-2.5 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg ${
                  studentData.status === 'present'
                    ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                    : 'bg-amber-500 text-white shadow-amber-500/30'
                }`}>
                  <CheckCircle2 className="w-6 h-6" />
                  <span>{studentData.status === 'present' ? '✅ KELDI' : '⏰ KECHIKDI'}</span>
                </div>

                <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>{new Date(studentData.checked_in_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
              </div>

              {/* Student Body: Big Photo + Big Name & Class */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-6">
                {/* Big Avatar Photo */}
                <div className="relative shrink-0">
                  <img
                    src={getAvatarUrl(studentData)}
                    alt={`${studentData.first_name} ${studentData.last_name}`}
                    className={`w-36 h-36 md:w-44 md:h-44 rounded-3xl object-cover border-4 shadow-2xl bg-slate-800 ${
                      studentData.status === 'present' ? 'border-emerald-500/60' : 'border-amber-500/60'
                    }`}
                  />
                  <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-blue-600 border-2 border-slate-900 flex items-center justify-center text-white shadow-lg">
                    <UserCheck className="w-5 h-5" />
                  </div>
                </div>

                {/* Name, Code, and Details */}
                <div className="flex-1 text-center sm:text-left">
                  <span className="inline-block px-3 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-mono font-bold mb-2">
                    ID: {studentData.student_code}
                  </span>

                  <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-tight mb-2">
                    {studentData.last_name}
                    <br />
                    <span className="text-slate-300 font-extrabold">{studentData.first_name}</span>
                  </h2>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-4">
                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200">
                      <School className="w-4 h-4 text-indigo-400" />
                      <span className="text-sm font-bold">{studentData.class_name || 'Sinf belgilanmagan'}</span>
                    </div>

                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold">
                      <Check className="w-4 h-4" />
                      <span>Davomat saqlandi</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Quick Bar */}
              <div className="w-full pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Keyingi skanerlash 2 soniyada avtomatik faollashadi
                </span>
                <span className="font-semibold text-emerald-400">Muvaqqiyatli</span>
              </div>

            </div>
          ) : (
            /* Idle Placeholder state when no scan is active */
            <div className="w-full bg-slate-900/40 backdrop-blur-xl border-2 border-dashed border-slate-800 rounded-3xl p-8 shadow-xl flex flex-col items-center justify-center text-center min-h-[420px] relative overflow-hidden group">
              <div className="w-20 h-20 rounded-3xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-5 shadow-inner group-hover:scale-105 transition-transform duration-300">
                <QrCode className="w-10 h-10 animate-pulse" />
              </div>

              <h3 className="text-2xl font-black text-white tracking-tight mb-2">
                O&apos;quvchi QR Kodini Ko&apos;rsating
              </h3>
              <p className="text-sm text-slate-400 max-w-md leading-relaxed mb-6">
                Kameraga o&apos;quvchining doimiy QR kodi yoki mobil ilovadagi QR kodi ko&apos;rsatilganda, ma&apos;lumotlar shu yerda katta hajmda bir lahzada paydo bo&apos;ladi.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-slate-400">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Kamera tayyor
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  Avtomatik tezkor qayd
                </span>
              </div>
            </div>
          )}

          {/* Recent Scans Strip */}
          {recentScans.length > 0 && (
            <div className="mt-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center justify-between mb-3 text-xs font-bold text-slate-400">
                <span className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-blue-400" />
                  So&apos;nggi qayd etilganlar
                </span>
                <span className="text-[11px] text-slate-500">{recentScans.length} ta o&apos;quvchi</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {recentScans.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-slate-800/60 border border-slate-700/40 text-xs">
                    <img 
                      src={getAvatarUrl(item)} 
                      alt="" 
                      className="w-7 h-7 rounded-lg object-cover bg-slate-700 shrink-0" 
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white truncate text-[11px]">{item.first_name}</p>
                      <p className="text-[9px] text-slate-400">{item.timeFormatted}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: HIGH-TECH QR CAMERA (~45% width on LG)     */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="w-full max-w-[420px] aspect-square relative rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl bg-slate-950">
            
            {/* Always-on smooth QrCamera (Never killed/frozen, only paused via prop) */}
            <QrCamera
              active={cameraOn}
              paused={busyRef.current}
              onScan={handleQrDetected}
            />

            {/* Viewfinder Target & Laser Animation */}
            {scanStatus === 'scanning' && cameraOn && (
              <div className="absolute inset-0 pointer-events-none flex flex-col justify-center items-center">
                <div className="w-60 h-60 border-2 border-blue-500/30 rounded-3xl relative">
                  {/* Glowing Laser Line */}
                  <div 
                    className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_15px_#3b82f6]"
                    style={{ animation: 'bounce 2.2s infinite ease-in-out' }}
                  />
                  {/* 4 Neon Corners */}
                  <div className="absolute -top-1.5 -left-1.5 w-7 h-7 border-t-4 border-l-4 border-blue-500 rounded-tl-2xl shadow-[0_0_10px_#3b82f6]" />
                  <div className="absolute -top-1.5 -right-1.5 w-7 h-7 border-t-4 border-r-4 border-blue-500 rounded-tr-2xl shadow-[0_0_10px_#3b82f6]" />
                  <div className="absolute -bottom-1.5 -left-1.5 w-7 h-7 border-b-4 border-l-4 border-blue-500 rounded-bl-2xl shadow-[0_0_10px_#3b82f6]" />
                  <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 border-b-4 border-r-4 border-blue-500 rounded-br-2xl shadow-[0_0_10px_#3b82f6]" />
                </div>
              </div>
            )}

            {/* Overlay: Fast 1-2s Verification Loader */}
            {scanStatus === 'verifying' && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-3 z-30 animate-in fade-in duration-100">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
                  <QrCode className="w-6 h-6 text-blue-400 absolute inset-0 m-auto animate-pulse" />
                </div>
                <span className="font-bold text-sm text-white tracking-wide">O&apos;quvchi tekshirilmoqda...</span>
              </div>
            )}

            {/* Overlay: Error Notice */}
            {scanStatus === 'error' && (
              <div className="absolute inset-0 bg-rose-950/90 backdrop-blur-md flex flex-col items-center justify-center gap-3 z-30 text-white p-6 text-center animate-in zoom-in-95 duration-150">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-lg">
                  <XCircle className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-black tracking-tight">Qabul qilinmadi</h4>
                <p className="text-xs text-rose-200 font-medium max-w-xs leading-relaxed">{errorMessage}</p>
              </div>
            )}

            {/* Camera Off State */}
            {!cameraOn && (
              <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-400 p-6 text-center z-30">
                <p className="text-sm font-semibold">Kamera o&apos;chirilgan</p>
                <button
                  onClick={() => setCameraOn(true)}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/30 cursor-pointer"
                >
                  Kamerani yoqish
                </button>
              </div>
            )}

          </div>

          <p className="mt-4 text-xs font-semibold text-slate-400 text-center">
            {t('scanQr')}
          </p>
        </div>

      </main>
    </div>
  )
}
