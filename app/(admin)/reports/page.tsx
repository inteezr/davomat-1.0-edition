'use client'

import { useState, useEffect } from 'react'
import { 
  FileSpreadsheet, 
  Download, 
  Printer, 
  School, 
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Search
} from 'lucide-react'

import { useLanguage } from '@/lib/i18n/LanguageContext'
import { fastFetch, getSyncCachedData } from '@/lib/client-cache'

interface ClassOption {
  id: string
  name: string
}

interface LogItem {
  id: string
  date: string
  status: 'present' | 'absent' | 'late' | 'excused'
  checked_in_at: string | null
  method: string | null
  first_name: string
  last_name: string
  student_code: string
  class_name: string
  recorded_by_name: string | null
}

export default function ReportsPage() {
  const { t } = useLanguage()
  const cachedClasses = typeof window !== 'undefined' ? getSyncCachedData<{ data: ClassOption[] }>('/api/classes') : null
  const initialClassList = cachedClasses?.data || []

  const [classes, setClasses] = useState<ClassOption[]>(initialClassList)
  const [selectedClassId, setSelectedClassId] = useState(() => initialClassList.length > 0 ? initialClassList[0].id : '')
  
  // Dates default range: last 7 days to today
  const getUzDateOffset = (offsetDays: number) => {
    const now = new Date()
    const offsetDate = new Date(now.getTime() + (5 * 60 * 60 * 1000) - (offsetDays * 24 * 60 * 60 * 1000))
    return offsetDate.toISOString().split('T')[0]
  }

  const [startDate, setStartDate] = useState(getUzDateOffset(7))
  const [endDate, setEndDate] = useState(getUzDateOffset(0))
  
  const [previewLogs, setPreviewLogs] = useState<LogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch classes
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const data = await fastFetch('/api/classes')
        if (data?.data && data.data.length > 0) {
          setClasses(data.data)
          if (!selectedClassId) setSelectedClassId(data.data[0].id)
        }
      } catch (err) {
        console.error('Sinflarni yuklashda xatolik:', err)
      }
    }
    fetchClasses()
  }, [])

  // Fetch preview logs when filters change
  const handlePreview = async () => {
    if (!selectedClassId || !startDate || !endDate) return

    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({
        class_id: selectedClassId,
        start_date: startDate,
        end_date: endDate,
        limit: '500',
      })

      const res = await fetch(`/api/attendance/history?${query}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Yuklashda xatolik yuz berdi.')
        return
      }

      setPreviewLogs(data.data || [])
    } catch (err) {
      setError('Ma\'lumotlarni yuklashda xatolik.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => handlePreview())
  }, [selectedClassId, startDate, endDate])

  // Download Excel Matrix
  const handleExportExcel = () => {
    if (!selectedClassId || !startDate || !endDate) return
    
    const query = new URLSearchParams({
      class_id: selectedClassId,
      start_date: startDate,
      end_date: endDate
    })

    window.open(`/api/reports/excel?${query}`, '_blank')
  }

  // Print Browser View
  const handlePrint = () => {
    window.print()
  }

  // Stats calculation
  const totalLogs = previewLogs.length
  const presentCount = previewLogs.filter(l => l.status === 'present').length
  const lateCount = previewLogs.filter(l => l.status === 'late').length
  const absentCount = previewLogs.filter(l => l.status === 'absent').length
  const excusedCount = previewLogs.filter(l => l.status === 'excused').length
  
  const presentRate = totalLogs > 0 
    ? Math.round(((presentCount + lateCount) / totalLogs) * 100) 
    : 0

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 print:p-0 print:max-w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{t('reports')}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{t('attendanceReports')}</p>
        </div>
        
        {/* Actions Button Group */}
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            disabled={previewLogs.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 font-semibold transition-all text-sm cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            PDF
          </button>
          
          <button
            onClick={handleExportExcel}
            disabled={previewLogs.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-lg shadow-blue-600/20 text-sm hover:-translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            <Download className="w-4 h-4" />
            {t('exportExcel')}
          </button>
        </div>
      </div>

      {/* Print only header */}
      <div className="hidden print:block mb-8 text-center text-black">
        <h1 className="text-2xl font-bold">Smart Attendance System — Davomat Hisoboti</h1>
        <p className="text-sm mt-1">
          Sinf: {classes.find(c => c.id === selectedClassId)?.name || '—'} | 
          Sana oralig&apos;i: {startDate} dan {endDate} gacha
        </p>
        <p className="text-xs text-slate-400 mt-0.5">Yaratilgan vaqt: {new Date().toLocaleString()}</p>
      </div>

      {/* Filters Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-end gap-4 print:hidden">
        {/* Class select */}
        <div className="w-full md:flex-1 space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Sinf</label>
          <div className="relative">
            <School className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium"
            >
              <option value="" disabled>Sinfni tanlang</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name} sinfi</option>
              ))}
            </select>
          </div>
        </div>

        {/* Start Date */}
        <div className="w-full md:w-56 space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Boshlanish sanasi</label>
          <div className="relative">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium"
            />
          </div>
        </div>

        {/* End Date */}
        <div className="w-full md:w-56 space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Tugash sanasi</label>
          <div className="relative">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium"
            />
          </div>
        </div>
      </div>

      {/* Summary statistics row */}
      {previewLogs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <p className="text-xs text-slate-400 uppercase font-semibold">Jami yozuvlar</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalLogs}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <p className="text-xs text-slate-400 uppercase font-semibold text-emerald-500">Kelgan</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{presentCount}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <p className="text-xs text-slate-400 uppercase font-semibold text-yellow-500">Kechikkan</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{lateCount}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <p className="text-xs text-slate-400 uppercase font-semibold text-rose-500">Kelmagan</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{absentCount}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm col-span-2 md:col-span-1 bg-gradient-to-br from-white to-blue-50/10 dark:from-slate-900 dark:to-blue-950/10">
            <p className="text-xs text-slate-400 uppercase font-semibold text-blue-500">O&apos;rtacha ko&apos;rsatkich</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{presentRate}%</p>
          </div>
        </div>
      )}

      {/* Main Logs Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm print:border-none print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider print:bg-slate-100 print:text-black">
                <th className="px-6 py-4">Sana</th>
                <th className="px-6 py-4">O&apos;quvchi</th>
                <th className="px-6 py-4">Student ID</th>
                <th className="px-6 py-4">Holati</th>
                <th className="px-6 py-4">Vaqti</th>
                <th className="px-6 py-4">Metod</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm print:text-black">
              {loading ? (
                <tr className="print:hidden">
                  <td colSpan={6} className="py-20 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
                    <span className="text-slate-400">Yuklanmoqda...</span>
                  </td>
                </tr>
              ) : previewLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    Belgilangan sana oralig&apos;ida davomat yozuvlari topilmadi.
                  </td>
                </tr>
              ) : (
                previewLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-350">
                      {new Date(log.date).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-950 dark:text-white print:text-black">
                      {log.last_name} {log.first_name}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">
                      {log.student_code}
                    </td>
                    <td className="px-6 py-4">
                      {log.status === 'present' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 text-xs font-semibold print:bg-none print:text-emerald-600">
                          Keldi
                        </span>
                      )}
                      {log.status === 'late' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-yellow-50 dark:bg-yellow-950/20 text-yellow-600 dark:text-yellow-450 text-xs font-semibold print:bg-none print:text-yellow-600">
                          Kechikdi
                        </span>
                      )}
                      {log.status === 'absent' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-455 text-xs font-semibold print:bg-none print:text-rose-600">
                          Kelmadi
                        </span>
                      )}
                      {log.status === 'excused' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-450 text-xs font-semibold print:bg-none print:text-blue-600">
                          Sababli
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">
                      {log.checked_in_at 
                        ? new Date(log.checked_in_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) 
                        : '—'
                      }
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-500">
                      {log.method === 'qr' ? 'QR kod' : log.method === 'manual' ? 'Admin' : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
