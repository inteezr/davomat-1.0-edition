'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ArrowLeft,
  UserCheck,
  QrCode,
  Sparkles,
  School,
  History,
  Check,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle
} from 'lucide-react'
import QrCamera from '@/components/qr-camera'
import { 
  cacheStudentsLocally, 
  findStudentLocally, 
  saveOfflineAttendance, 
  getUnsyncedAttendance, 
  markAttendanceSynced,
  CachedStudent 
} from '@/lib/offline-db'

interface ScanSuccessData {
  id?: string
  first_name: string
  last_name: string
  student_code: string
  photo_url: string | null
  class_name: string | null
  checked_in_at: string
  status: 'present' | 'late'
  isOffline?: boolean
}

interface RecentScanItem extends ScanSuccessData {
  timeFormatted: string
}

type ScanStatus = 'idle' | 'scanning' | 'success' | 'error'

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
      osc.frequency.exponentialRampToValueAtTime(1800, now + 0.1)
      gain.gain.setValueAtTime(0.35, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
      osc.start(now)
      osc.stop(now + 0.12)
    } else {
      osc.type = 'square'
      osc.frequency.setValueAtTime(350, now)
      osc.frequency.setValueAtTime(200, now + 0.1)
      gain.gain.setValueAtTime(0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
      osc.start(now)
      osc.stop(now + 0.18)
    }
  } catch {}
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

  // Offline and Sync states
  const [isOnline, setIsOnline] = useState(true)
  const [unsyncedCount, setUnsyncedCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)

  const busyRef = useRef(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync offline records to server
  const syncOfflineQueue = useCallback(async () => {
    if (isSyncing) return
    try {
      const unsynced = await getUnsyncedAttendance()
      setUnsyncedCount(unsynced.length)
      if (unsynced.length === 0) return

      setIsSyncing(true)
      const res = await fetch('/api/attendance/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: unsynced })
      })

      const data = await res.json()
      if (res.ok && data.synced_ids && data.synced_ids.length > 0) {
        await markAttendanceSynced(data.synced_ids)
        const remaining = await getUnsyncedAttendance()
        setUnsyncedCount(remaining.length)
      }
    } catch (err) {
      console.warn('Sync failed:', err)
    } finally {
      setIsSyncing(false)
    }
  }, [isSyncing])

  // Initial load: Pre-cache all students locally for instant 0ms offline capability
  useEffect(() => {
    const initOfflineStorage = async () => {
      setIsOnline(navigator.onLine)

      try {
        const res = await fetch('/api/students?limit=2000')
        const data = await res.json()
        if (data.data && Array.isArray(data.data)) {
          const formatted: CachedStudent[] = data.data.map((s: any) => ({
            id: s.id,
            student_code: s.student_code,
            first_name: s.first_name,
            last_name: s.last_name,
            class_name: s.class_name || (s.classes?.name) || null,
            photo_url: s.photo_url || null,
            school_id: s.school_id
          }))
          await cacheStudentsLocally(formatted)
        }
      } catch (err) {
        console.warn('Background student pre-cache failed:', err)
      }

      // Check unsynced records
      const unsynced = await getUnsyncedAttendance()
      setUnsyncedCount(unsynced.length)
      if (navigator.onLine && unsynced.length > 0) {
        syncOfflineQueue()
      }
    }

    initOfflineStorage()

    const handleOnline = () => {
      setIsOnline(true)
      syncOfflineQueue()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [syncOfflineQueue])

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
      } catch {}
    }
    router.push('/dashboard')
  }

  // Instant QR Detection without loader or screen freeze
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

    setErrorMessage('')
    const nowIso = new Date().toISOString()
    const timeFmt = new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

    // 1. FAST PATH: Instant local lookup in IndexedDB (0ms)
    const localStudent = await findStudentLocally(token)

    if (localStudent) {
      if (soundEnabled) playBeep('success')

      const successStudent: ScanSuccessData = {
        id: localStudent.id,
        first_name: localStudent.first_name,
        last_name: localStudent.last_name,
        student_code: localStudent.student_code,
        photo_url: localStudent.photo_url,
        class_name: localStudent.class_name,
        checked_in_at: nowIso,
        status: 'present',
        isOffline: !navigator.onLine
      }

      // Immediately render student profile on the left
      setStudentData(successStudent)
      setScanStatus('success')
      setTodayCount(prev => prev + 1)
      setRecentScans(prev => [{ ...successStudent, timeFormatted: timeFmt }, ...prev.slice(0, 4)])

      // Save to offline queue
      const offlineRecord = {
        id: crypto.randomUUID(),
        token,
        student_id: localStudent.id,
        student_code: localStudent.student_code,
        first_name: localStudent.first_name,
        last_name: localStudent.last_name,
        class_name: localStudent.class_name,
        photo_url: localStudent.photo_url,
        status: 'present' as const,
        checked_in_at: nowIso,
        synced: false
      }
      saveOfflineAttendance(offlineRecord)

      // Background server update if online
      if (navigator.onLine) {
        fetch('/api/attendance/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        })
          .then(async (res) => {
            if (res.ok) {
              await markAttendanceSynced([offlineRecord.id])
            }
          })
          .catch(() => {
            setUnsyncedCount(prev => prev + 1)
          })
      } else {
        setUnsyncedCount(prev => prev + 1)
      }

      // Exactly 1.5 seconds display, then immediately ready for next QR
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setScanStatus('scanning')
        busyRef.current = false
      }, 1500)

      return
    }

    // 2. FALLBACK PATH: Online server check if not found in local cache
    try {
      const res = await fetch('/api/attendance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        if (soundEnabled) playBeep('error')
        setErrorMessage(data.message || 'QR kod topilmadi yoki tasdiqlanmadi.')
        setScanStatus('error')
        
        // Show error on the left for 1.5s then resume
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          setScanStatus('scanning')
          busyRef.current = false
        }, 1500)
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
        status: data.status,
        isOffline: false
      }

      setStudentData(successStudent)
      setScanStatus('success')
      setTodayCount(prev => prev + 1)
      setRecentScans(prev => [{ ...successStudent, timeFormatted: timeFmt }, ...prev.slice(0, 4)])

      // Cache locally for future 0ms scans
      cacheStudentsLocally([{
        id: data.student.id,
        student_code: data.student.student_code,
        first_name: data.student.first_name,
        last_name: data.student.last_name,
        class_name: data.class_name,
        photo_url: data.student.photo_url
      }])

      // 1.5s delay then ready for next
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setScanStatus('scanning')
        busyRef.current = false
      }, 1500)

    } catch {
      if (soundEnabled) playBeep('error')
      setErrorMessage('QR kod topilmadi.')
      setScanStatus('error')
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
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
              <p className="text-[11px] text-slate-400 font-medium">Uzluksiz 0ms tezkor QR davomat</p>
            </div>

            {/* Offline/Online indicator */}
            <div className="hidden sm:flex items-center gap-2">
              {isOnline ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                  <Wifi className="w-3.5 h-3.5" />
                  Online
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold animate-pulse">
                  <WifiOff className="w-3.5 h-3.5" />
                  Offline Rejim (0ms)
                </span>
              )}

              {/* Unsynced queue badge */}
              {unsyncedCount > 0 && (
                <button
                  onClick={syncOfflineQueue}
                  disabled={isSyncing || !isOnline}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-bold hover:bg-blue-500/25 transition-all cursor-pointer"
                  title="Serverga sinxronlashtirish"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{unsyncedCount} ta saqlandi (Sinxronlash)</span>
                </button>
              )}
            </div>
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

      {/* Main Grid: LEFT (Big Student Profile / Status Messages) + RIGHT (Clean Always-On Camera) */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 md:p-8 max-w-7xl w-full mx-auto items-center relative z-10 overflow-y-auto">
        
        {/* ========================================================= */}
        {/* LEFT COLUMN: BIG STUDENT DETAILS / STATUS MESSAGES CARD    */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 flex flex-col justify-center h-full min-h-[460px]">
          {scanStatus === 'success' && studentData ? (
            /* SUCCESS: Instant Large Student Profile View */
            <div className="w-full bg-slate-900/90 backdrop-blur-2xl border-2 border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between animate-in zoom-in-95 duration-150">
              
              {/* 1.5-second Progress Bar countdown on top */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-slate-800 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-[1500ms] ease-linear ${
                    studentData.status === 'present' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: '0%' }}
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
                  <span>{studentData.status === 'present' ? '✅ Tasdiqlandi: KELDI' : '⏰ Tasdiqlandi: KECHIKDI'}</span>
                  {studentData.isOffline && <span className="text-[10px] bg-black/30 px-2 py-0.5 rounded-md">Offline</span>}
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
                      <span>Davomat qayd etildi</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Quick Bar */}
              <div className="w-full pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Keyingi o&apos;quvchi 1.5 soniyada qabul qilinadi
                </span>
                <span className="font-semibold text-emerald-400">0ms Tezkor Qayd</span>
              </div>

            </div>
          ) : scanStatus === 'error' ? (
            /* ERROR: Rejected Message Card on Left */
            <div className="w-full bg-rose-950/40 backdrop-blur-2xl border-2 border-rose-800/80 rounded-3xl p-8 shadow-2xl flex flex-col items-center justify-center text-center min-h-[420px] relative overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="w-20 h-20 rounded-3xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-5 shadow-lg">
                <XCircle className="w-10 h-10" />
              </div>

              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/20 text-rose-300 font-bold text-xs uppercase tracking-wider mb-3">
                <AlertTriangle className="w-4 h-4" />
                <span>❌ Rad etildi</span>
              </div>

              <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-2">
                QR Kod Qabul Qilinmadi
              </h3>
              <p className="text-sm text-rose-200 max-w-md leading-relaxed mb-6">
                {errorMessage || 'Ushbu QR kod tizimda topilmadi yoki nofaol.'}
              </p>

              <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Kamera avtomatik yangi QR kodni kutmoqda...
              </span>
            </div>
          ) : (
            /* IDLE: Placeholder state when waiting for QR */
            <div className="w-full bg-slate-900/40 backdrop-blur-xl border-2 border-dashed border-slate-800 rounded-3xl p-8 shadow-xl flex flex-col items-center justify-center text-center min-h-[420px] relative overflow-hidden group">
              <div className="w-20 h-20 rounded-3xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-5 shadow-inner group-hover:scale-105 transition-transform duration-300">
                <QrCode className="w-10 h-10 animate-pulse" />
              </div>

              <h3 className="text-2xl font-black text-white tracking-tight mb-2">
                O&apos;quvchi QR Kodini Ko&apos;rsating
              </h3>
              <p className="text-sm text-slate-400 max-w-md leading-relaxed mb-6">
                Kameraga QR kod ko&apos;rsatilishi bilan o&apos;quvchi ma&apos;lumotlari bir lahzada (0ms) paydo bo&apos;ladi va 1.5 soniyada keyingi o&apos;quvchiga o&apos;tadi.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-slate-400">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Kamera doimiy faol
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  1.5s Ultra-tezkor oraliq
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
        {/* RIGHT COLUMN: CLEAN ALWAYS-ON HIGH-TECH QR CAMERA         */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="w-full max-w-[520px] aspect-square relative rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl bg-slate-950">
            
            {/* Always-on smooth QrCamera — NEVER STOPPED / NEVER FROZEN */}
            <QrCamera
              active={cameraOn}
              paused={false}
              onScan={handleQrDetected}
            />

            {/* Viewfinder Target & Laser Animation */}
            {cameraOn && (
              <div className="absolute inset-0 pointer-events-none flex flex-col justify-center items-center">
                <div className="w-72 h-72 sm:w-80 sm:h-80 border-2 border-blue-500/30 rounded-3xl relative">
                  {/* Glowing Laser Line */}
                  <div 
                    className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_15px_#3b82f6]"
                    style={{ animation: 'bounce 2.2s infinite ease-in-out' }}
                  />
                  {/* 4 Neon Corners */}
                  <div className="absolute -top-1.5 -left-1.5 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-2xl shadow-[0_0_12px_#3b82f6]" />
                  <div className="absolute -top-1.5 -right-1.5 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-2xl shadow-[0_0_12px_#3b82f6]" />
                  <div className="absolute -bottom-1.5 -left-1.5 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-2xl shadow-[0_0_12px_#3b82f6]" />
                  <div className="absolute -bottom-1.5 -right-1.5 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-2xl shadow-[0_0_12px_#3b82f6]" />
                </div>
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
