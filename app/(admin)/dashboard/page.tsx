'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { fastFetch, invalidateClientCache, getSyncCachedData } from '@/lib/client-cache'
import { 
  Users, 
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertCircle,
  TrendingUp,
  School,
  QrCode,
  Loader2,
  Calendar,
  Sparkles
} from 'lucide-react'

interface StatsData {
  totalStudents: number
  today: {
    present: number
    late: number
    absent: number
    excused: number
    rate: number
  }
  classes: Array<{ id: string; name: string; total: number; present: number; excused?: number; absent?: number; rate: number }>
  trend: Array<{ rawDate: string; present: number; late: number; excused: number; absent: number; total: number; rate: number; hasRecords: boolean }>
}

interface RecentLog {
  id: string
  first_name: string
  last_name: string
  student_code: string
  class_name: string
  status: 'present' | 'absent' | 'late' | 'excused'
  checked_in_at: string
  method: 'qr' | 'manual'
}

export default function DashboardPage() {
  const { t, language } = useLanguage()
  const initialCached = typeof window !== 'undefined' ? getSyncCachedData<StatsData>('/api/attendance/stats') : null
  const [stats, setStats] = useState<StatsData | null>(initialCached)
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([])
  const [loading, setLoading] = useState(() => !initialCached)
  const mountedRef = useRef(false)

  useEffect(() => { mountedRef.current = true }, [])

  // Popup Modal States
  const [activePopup, setActivePopup] = useState<'present' | 'late' | 'absent' | null>(null)
  const [popupStudents, setPopupStudents] = useState<any[]>([])
  const [popupLoading, setPopupLoading] = useState(false)
  const [popupSearch, setPopupSearch] = useState('')

  // Excuse (Sababli) modal state
  const [excuseStudent, setExcuseStudent] = useState<any | null>(null)
  const [excuseReason, setExcuseReason] = useState('')
  const [excuseSaving, setExcuseSaving] = useState(false)
  const [excuseSuccess, setExcuseSuccess] = useState(false)

  // Class Popup Modal States
  const [activeClassPopupId, setActiveClassPopupId] = useState<string | null>(null)
  const [classPopupStudents, setClassPopupStudents] = useState<any[]>([])
  const [classPopupLoading, setClassPopupLoading] = useState(false)
  const [classPopupClassName, setClassPopupClassName] = useState('')
  const [classPopupSearch, setClassPopupSearch] = useState('')

  // Weekly Trend Range Options (e.g., 21.08 - 27.08, 14.08 - 20.08, 07.08 - 13.08, 31.07 - 06.08)
  const weekOptions = (() => {
    const nowUz = new Date(new Date().getTime() + 5 * 60 * 60 * 1000)
    const list: Array<{ label: string; start: string; end: string }> = []
    
    for (let w = 0; w < 4; w++) {
      const endD = new Date(nowUz.getTime() - w * 7 * 24 * 60 * 60 * 1000)
      const startD = new Date(endD.getTime() - 6 * 24 * 60 * 60 * 1000)
      
      const endStr = endD.toISOString().split('T')[0]
      const startStr = startD.toISOString().split('T')[0]
      
      const formatDisplay = (d: Date) => {
        const day = String(d.getDate()).padStart(2, '0')
        const mon = String(d.getMonth() + 1).padStart(2, '0')
        return `${day}.${mon}`
      }
      
      const label = `${formatDisplay(startD)} - ${formatDisplay(endD)}`
      list.push({ label, start: startStr, end: endStr })
    }
    return list
  })()

  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0)

  const fetchDashboardData = async (customStart?: string, customEnd?: string) => {
    try {
      const nowUz = new Date(new Date().getTime() + 5 * 60 * 60 * 1000)
      const todayStr = nowUz.toISOString().split('T')[0]

      const activeRange = weekOptions[selectedWeekIndex] || weekOptions[0]
      const startParam = customStart || activeRange.start
      const endParam = customEnd || activeRange.end

      const [statsData, logsData] = await Promise.all([
        fastFetch(`/api/attendance/stats?start_date=${startParam}&end_date=${endParam}`).catch(() => null),
        fastFetch(`/api/attendance/history?date=${todayStr}&limit=5`).catch(() => null)
      ])

      if (statsData && statsData.today) {
        setStats(statsData)
      } else if (!stats) {
        setStats({
          totalStudents: 0,
          today: { present: 0, late: 0, absent: 0, excused: 0, rate: 0 },
          classes: [],
          trend: []
        })
      }

      if (logsData && Array.isArray(logsData.data)) {
        setRecentLogs(logsData.data)
      } else {
        setRecentLogs([])
      }

    } catch (err) {
      console.error('Dashboard ma\'lumotlarini yuklashda xatolik:', err)
      if (!stats) {
        setStats({
          totalStudents: 0,
          today: { present: 0, late: 0, absent: 0, excused: 0, rate: 0 },
          classes: [],
          trend: []
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleWeekChange = (newIndex: number) => {
    setSelectedWeekIndex(newIndex)
    const range = weekOptions[newIndex]
    if (range) {
      fetchDashboardData(range.start, range.end)
    }
  }

  const openStatusPopup = async (status: 'present' | 'late' | 'absent') => {
    setActivePopup(status)
    setPopupSearch('')
    try {
      const data = await fastFetch(`/api/attendance/stats/students?status=${status}`)
      if (data && data.success) {
        setPopupStudents(data.students || [])
      }
    } catch (err) {
      console.error('Popup student logs fetch error:', err)
    } finally {
      setPopupLoading(false)
    }
  }

  const openClassPopup = async (classId: string) => {
    setActiveClassPopupId(classId)
    setClassPopupSearch('')
    try {
      const data = await fastFetch(`/api/attendance/stats/class-students?class_id=${classId}`)
      if (data && data.success) {
        setClassPopupStudents(data.students || [])
        setClassPopupClassName(data.className || '')
      }
    } catch (err) {
      console.error('Class popup fetch error:', err)
    } finally {
      setClassPopupLoading(false)
    }
  }

  const openExcuseModal = (student: any) => {
    setExcuseStudent(student)
    setExcuseReason('')
    setExcuseSuccess(false)
  }

  const saveExcuse = async () => {
    if (!excuseStudent) return
    setExcuseSaving(true)
    const targetStudentId = excuseStudent.id
    const targetReason = excuseReason
    try {
      const res = await fetch('/api/attendance/excuse', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: targetStudentId, reason: targetReason || null })
      })
      if (res.ok) {
        // Update local list: set student's status to 'excused' so it stays with yellow badge
        setPopupStudents(prev => prev.map(s => s.id === targetStudentId ? { ...s, status: 'excused', notes: targetReason || null } : s))
        // Invalidate attendance cache so fresh data is loaded
        invalidateClientCache('/api/attendance')
        // Close modal immediately
        setExcuseStudent(null)
        // Refresh dashboard stats immediately
        fetchDashboardData()
      }
    } catch (err) {
      console.error('Excuse save error:', err)
    } finally {
      setExcuseSaving(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
    const interval = setInterval(fetchDashboardData, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-2" />
        <span>{t('loading')}</span>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="p-8 text-center text-slate-400">
        {t('notFound')}
      </div>
    )
  }

  // Filter local popup students based on search input
  const filteredPopupStudents = popupStudents.filter(s => {
    const fullName = `${s.last_name} ${s.first_name}`.toLowerCase()
    const code = (s.student_code || '').toLowerCase()
    const cls = (s.class_name || '').toLowerCase()
    const query = popupSearch.toLowerCase()
    return fullName.includes(query) || code.includes(query) || cls.includes(query)
  })

  // Filter class popup students locally based on search input
  const filteredClassPopupStudents = classPopupStudents.filter(s => {
    const fullName = `${s.last_name} ${s.first_name}`.toLowerCase()
    const code = (s.student_code || '').toLowerCase()
    const query = classPopupSearch.toLowerCase()
    return fullName.includes(query) || code.includes(query)
  })

  const locale = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'uz-UZ'

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{t('dashboard')}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 capitalize">
            {new Date().toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 rounded-xl text-xs font-bold">
          <QrCode className="w-4 h-4 animate-pulse" />
          <span>{t('realtimeActive')}</span>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {/* Total Students */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('totalStudents')}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats?.totalStudents ?? 0}</p>
          </div>
        </div>

        {/* Present */}
        <button 
          onClick={() => openStatusPopup('present')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-center gap-4 relative overflow-hidden cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-800/80 hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider group-hover:text-emerald-500 transition-colors">{t('present')}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats?.today?.present ?? 0}</p>
          </div>
        </button>

        {/* Late */}
        <button 
          onClick={() => openStatusPopup('late')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-center gap-4 relative overflow-hidden cursor-pointer hover:border-yellow-300 dark:hover:border-yellow-800/80 hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-yellow-50 dark:bg-yellow-950/50 flex items-center justify-center text-yellow-600 dark:text-yellow-400 group-hover:scale-105 transition-transform">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider group-hover:text-yellow-500 transition-colors">{t('late')}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats?.today?.late ?? 0}</p>
          </div>
        </button>

        {/* Absent */}
        <button 
          onClick={() => openStatusPopup('absent')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-center gap-4 relative overflow-hidden cursor-pointer hover:border-rose-300 dark:hover:border-rose-800/80 hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 group-hover:scale-105 transition-transform">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider group-hover:text-rose-500 transition-colors">{t('absent')}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats?.today?.absent ?? 0}</p>
          </div>
        </button>

        {/* Rate Gauge Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-center gap-4 relative overflow-hidden bg-gradient-to-br from-white to-blue-50/20 dark:from-slate-900 dark:to-blue-950/10">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-600/20">
            {stats?.today?.rate ?? 0}%
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('rateGauge')}</p>
            <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{t('todayActivity')}</p>
          </div>
        </div>
      </div>

      {/* Grid: Trends & Class list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Trend chart using custom elements */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm lg:col-span-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('last7DaysTrend')}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              {/* Legend */}
              <div className="hidden md:flex items-center gap-3 text-xs font-medium">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-slate-500">{t('present')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  <span className="text-slate-500">{t('late')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-slate-500">{t('excused')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-slate-500">{t('absent')}</span>
                </div>
              </div>

              {/* Date Range Select Dropdown */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 shadow-inner">
                <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <select
                  value={selectedWeekIndex}
                  onChange={(e) => handleWeekChange(Number(e.target.value))}
                  className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-transparent focus:outline-none cursor-pointer pr-1"
                >
                  {weekOptions.map((opt, idx) => (
                    <option key={opt.start} value={idx} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                      {idx === 0 ? `Joriy hafta (${opt.label})` : opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Real Database 7-Day Trend Bar Chart */}
          <div className="h-64 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-slate-100 dark:border-slate-800">
            {stats?.trend?.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                {t('notFound')}
              </div>
            ) : (
              stats?.trend?.map((item) => {
                const total = item.total || 1
                const pPct = item.hasRecords ? Math.round((item.present / total) * 100) : 0
                const lPct = item.hasRecords ? Math.round((item.late / total) * 100) : 0
                const ePct = item.hasRecords ? Math.round((item.excused / total) * 100) : 0
                const aPct = item.hasRecords ? Math.max(0, 100 - pPct - lPct - ePct) : 0

                const dateObj = new Date(item.rawDate + 'T12:00:00')
                const dayName = dateObj.toLocaleDateString(locale, { weekday: 'short' })
                const dayNum = dateObj.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
                const isToday = item.rawDate === new Date(Date.now() + 5 * 3600 * 1000).toISOString().split('T')[0]

                return (
                  <div key={item.rawDate} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative">
                    
                    {/* Tooltip on Hover */}
                    <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-30 transform group-hover:-translate-y-1">
                      <div className="bg-slate-900 text-white text-[11px] rounded-xl px-3 py-2 shadow-2xl border border-slate-700 whitespace-nowrap min-w-[140px] space-y-1">
                        <p className="font-bold border-b border-slate-700 pb-1 text-slate-300">
                          {dateObj.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                        {item.hasRecords ? (
                          <>
                            <p className="text-emerald-400">✅ {t('present')}: <span className="font-bold text-white">{item.present}</span></p>
                            <p className="text-yellow-400">⏰ {t('late')}: <span className="font-bold text-white">{item.late}</span></p>
                            <p className="text-amber-400">📋 {t('excused')}: <span className="font-bold text-white">{item.excused}</span></p>
                            <p className="text-rose-400">❌ {t('absent')}: <span className="font-bold text-white">{item.absent}</span></p>
                            <p className="pt-1 border-t border-slate-700 text-blue-400 font-bold">
                              📊 {t('rateGauge')}: {item.rate}%
                            </p>
                          </>
                        ) : (
                          <p className="text-slate-400 italic">Ma&apos;lumot yo&apos;q</p>
                        )}
                      </div>
                    </div>

                    {/* Rate pill on top of bar */}
                    <span className={`text-[10px] font-bold ${
                      isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'
                    }`}>
                      {item.hasRecords ? `${item.rate}%` : '—'}
                    </span>

                    {/* Visual Bar */}
                    <div className="w-full flex items-end justify-center h-full max-w-[44px]">
                      <div className={`w-full flex flex-col-reverse rounded-xl overflow-hidden shadow-sm h-full max-h-[160px] ${
                        isToday ? 'ring-2 ring-blue-500/40' : ''
                      } ${item.hasRecords ? 'bg-slate-100 dark:bg-slate-800/40' : 'bg-slate-100/50 dark:bg-slate-800/20'}`}>
                        {pPct > 0 && <div style={{ height: `${pPct}%` }} className="bg-emerald-500 w-full transition-all" />}
                        {lPct > 0 && <div style={{ height: `${lPct}%` }} className="bg-yellow-500 w-full transition-all" />}
                        {ePct > 0 && <div style={{ height: `${ePct}%` }} className="bg-amber-500 w-full transition-all" />}
                        {aPct > 0 && <div style={{ height: `${aPct}%` }} className="bg-rose-500 w-full transition-all" />}
                      </div>
                    </div>

                    {/* Day label */}
                    <div className="text-center">
                      <p className={`text-[11px] font-bold capitalize leading-tight ${
                        isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'
                      }`}>
                        {dayName}
                      </p>
                      <p className="text-[9px] text-slate-400 leading-tight">
                        {dayNum}
                      </p>
                    </div>

                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Classes List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <School className="w-5 h-5 text-blue-500" />
              {t('attendanceByClasses')}
            </h2>
            <div className="space-y-4 overflow-y-auto max-h-[260px] pr-1">
              {stats?.classes?.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">{t('notFound')}</p>
              ) : (
                stats?.classes?.map((cls) => (
                  <div
                    key={cls.id}
                    onClick={() => openClassPopup(cls.id)}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/60 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{cls.name}</span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{cls.present} / {cls.total}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200/80 dark:bg-slate-700 overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${cls.rate}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Log */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            {t('recentActivity')}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                <th className="pb-3 px-4">#</th>
                <th className="pb-3 px-4">{t('lastName')} / {t('firstName')}</th>
                <th className="pb-3 px-4">{t('studentId')}</th>
                <th className="pb-3 px-4">{t('class')}</th>
                <th className="pb-3 px-4">{t('status')}</th>
                <th className="pb-3 px-4">Vaqt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">{t('notFound')}</td>
                </tr>
              ) : (
                recentLogs.map((log, index) => {
                  const isPresent = log.status === 'present'
                  const isLate = log.status === 'late'
                  const isExcused = log.status === 'excused'

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-mono text-xs">{index + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {log.last_name} {log.first_name}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500">{log.student_code}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold">
                          {log.class_name || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                          isPresent ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' :
                          isLate ? 'bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-400' :
                          isExcused ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400' :
                          'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isPresent ? 'bg-emerald-500' :
                            isLate ? 'bg-yellow-500' :
                            isExcused ? 'bg-amber-500' :
                            'bg-rose-500'
                          }`} />
                          {isPresent ? t('present') : isLate ? t('late') : isExcused ? t('excused') : t('absent')}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500">
                        {log.checked_in_at ? new Date(log.checked_in_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== STATUS POPUP MODAL ===== */}
      {mountedRef.current && activePopup && createPortal(
        <div
          className="fixed flex items-center justify-center p-4"
          style={{
            top: 0, left: 0, right: 0, bottom: 0,
            width: '100vw', height: '100vh',
            backgroundColor: 'rgba(2,6,23,0.78)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 99999,
          }}
          onClick={() => setActivePopup(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              onClick={() => setActivePopup(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors z-10 cursor-pointer"
            >
              <XCircle className="w-6 h-6" />
            </button>

            {/* Modal Header */}
            <div className={`p-6 border-b border-slate-100 dark:border-slate-800 ${
              activePopup === 'present' ? 'bg-emerald-50/60 dark:bg-emerald-950/20' :
              activePopup === 'late' ? 'bg-amber-50/60 dark:bg-amber-950/20' :
              'bg-rose-50/60 dark:bg-rose-950/20'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                  activePopup === 'present' ? 'bg-emerald-100 dark:bg-emerald-900/40' :
                  activePopup === 'late' ? 'bg-amber-100 dark:bg-amber-900/40' :
                  'bg-rose-100 dark:bg-rose-900/40'
                }`}>
                  {activePopup === 'present' ? '✅' : activePopup === 'late' ? '⏰' : '❌'}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {activePopup === 'present' && t('presentStudentsToday')}
                    {activePopup === 'late' && t('lateStudentsToday')}
                    {activePopup === 'absent' && t('absentStudentsToday')}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{t('totalCount')}: {filteredPopupStudents.length} {t('studentsCount')}</p>
                </div>
              </div>
            </div>

            {/* Search Input */}
            <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800/80">
              <input
                type="text"
                placeholder={t('searchStudentOrClass')}
                value={popupSearch}
                onChange={(e) => setPopupSearch(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                autoFocus
              />
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 min-h-[260px]">
              {popupLoading ? (
                <div className="h-48 flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                  <span>{t('loading')}</span>
                </div>
              ) : filteredPopupStudents.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-slate-400 text-sm">{t('notFound')}</div>
              ) : (
                <div className="space-y-2.5">
                  {filteredPopupStudents.map((student) => {
                    const isExcused = student.status === 'excused'
                    const canMakeExcuse = activePopup === 'absent' && !isExcused

                    return (
                      <div
                        key={student.id}
                        onClick={() => canMakeExcuse ? openExcuseModal(student) : undefined}
                        className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                          isExcused
                            ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40 cursor-default'
                            : canMakeExcuse
                            ? 'bg-slate-50 dark:bg-slate-800/20 border-slate-100 dark:border-slate-800/50 cursor-pointer hover:bg-amber-50/40 dark:hover:bg-amber-950/20 hover:border-amber-300 dark:hover:border-amber-800/60'
                            : 'bg-slate-50 dark:bg-slate-800/20 border-slate-100 dark:border-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isExcused
                              ? 'bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
                              : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                          }`}>
                            {student.first_name?.[0]}{student.last_name?.[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-slate-900 dark:text-white">{student.last_name} {student.first_name}</p>
                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">{student.student_code}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold">{student.class_name || '—'}</span>
                          
                          {isExcused ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                              <span>📋</span> {t('excused')}
                            </span>
                          ) : canMakeExcuse ? (
                            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 transition-colors">
                              {t('excused')} →
                            </span>
                          ) : null}

                          {student.checked_in_at && (
                            <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800/60 px-2 py-1 rounded-lg">
                              {new Date(student.checked_in_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 text-right">
              <button
                onClick={() => setActivePopup(null)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ===== EXCUSE (SABABLI) MODAL ===== */}
      {mountedRef.current && excuseStudent && createPortal(
        <div
          className="fixed flex items-center justify-center p-4"
          style={{
            top: 0, left: 0, right: 0, bottom: 0,
            width: '100vw', height: '100vh',
            backgroundColor: 'rgba(2,6,23,0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            zIndex: 100000,
          }}
          onClick={() => setExcuseStudent(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Student card — top */}
            <div className="p-6 bg-amber-50/60 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900/30">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                  {excuseStudent.first_name?.[0]}{excuseStudent.last_name?.[0]}
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {excuseStudent.last_name} {excuseStudent.first_name}
                  </p>
                  <p className="text-xs font-mono text-slate-500 mt-0.5">{excuseStudent.student_code}</p>
                  {excuseStudent.class_name && (
                    <span className="mt-1 inline-flex px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                      {excuseStudent.class_name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Status change */}
            <div className="p-6 space-y-5">
              {excuseSuccess ? (
                <div className="flex flex-col items-center justify-center py-6 gap-3">
                  <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center text-3xl shadow-sm animate-bounce">✓</div>
                  <p className="font-bold text-base text-slate-800 dark:text-slate-100">{t('statusChangedSuccess')}</p>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">{t('changeStatus')}</p>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30">
                      <div className="w-4 h-4 rounded-full bg-amber-400 shrink-0" />
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{t('excused')}</span>
                      <span className="ml-auto text-xs text-amber-600/70 font-medium">{t('selected')}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {t('reasonOptional')}
                    </label>
                    <input
                      type="text"
                      value={excuseReason}
                      onChange={(e) => setExcuseReason(e.target.value)}
                      placeholder={t('reasonPlaceholder')}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-amber-400/40 text-sm"
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setExcuseStudent(null)}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      onClick={saveExcuse}
                      disabled={excuseSaving}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold transition-colors shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-60"
                    >
                      {excuseSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('saveExcused')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Class Detail Popup Modal */}
      {mountedRef.current && activeClassPopupId && createPortal(
        <div
          className="fixed flex items-center justify-center p-4"
          style={{
            top: 0, left: 0, right: 0, bottom: 0,
            width: '100vw', height: '100vh',
            backgroundColor: 'rgba(2,6,23,0.78)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 99999,
          }}
          onClick={() => setActiveClassPopupId(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              onClick={() => setActiveClassPopupId(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors z-10 cursor-pointer"
            >
              <XCircle className="w-6 h-6" />
            </button>

            {/* Modal Header */}
            <div className="p-6 bg-blue-50/60 dark:bg-blue-950/20 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-lg">🏫</div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{classPopupClassName}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{t('totalCount')}: {filteredClassPopupStudents.length} {t('studentsCount')}</p>
                </div>
              </div>
            </div>

            {/* Search Input */}
            <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800/80">
              <input
                type="text"
                placeholder={t('searchInClass')}
                value={classPopupSearch}
                onChange={(e) => setClassPopupSearch(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                autoFocus
              />
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 min-h-[260px]">
              {classPopupLoading ? (
                <div className="h-48 flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                  <span>{t('loading')}</span>
                </div>
              ) : filteredClassPopupStudents.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-slate-400 text-sm">{t('notFound')}</div>
              ) : (
                <div className="space-y-2.5">
                  {filteredClassPopupStudents.map((student, idx) => {
                    const status = student.attendance_status
                    const statusColor = 
                      status === 'present' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50' :
                      status === 'late'    ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-400 dark:border-yellow-900/50' :
                      status === 'excused' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50' :
                                            'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50'

                    const statusLabel =
                      status === 'present' ? t('present') :
                      status === 'late'    ? t('late') :
                      status === 'excused' ? t('excused') :
                                            t('absent')

                    const statusIcon =
                      status === 'present' ? '✅' :
                      status === 'late'    ? '⏰' :
                      status === 'excused' ? '📋' :
                                            '❌'
                    return (
                      <div
                        key={student.id}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Index + Avatar */}
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-mono text-slate-400 w-5 shrink-0 text-center">{idx + 1}</span>
                          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center font-bold text-blue-600 dark:text-blue-400 text-xs shrink-0">
                            {student.first_name?.[0]}{student.last_name?.[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-slate-900 dark:text-white">{student.last_name} {student.first_name}</p>
                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">{student.student_code}</p>
                          </div>
                        </div>

                        {/* Status + Time */}
                        <div className="flex items-center gap-2">
                          {student.checked_in_at && (
                            <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800/60 px-2 py-1 rounded-lg">
                              {new Date(student.checked_in_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 ${statusColor}`}>
                            <span>{statusIcon}</span>
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 text-right">
              <button
                onClick={() => setActiveClassPopupId(null)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
