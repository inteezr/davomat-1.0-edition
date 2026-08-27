'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { 
  School, 
  Clock, 
  QrCode, 
  Check, 
  AlertCircle,
  Loader2
} from 'lucide-react'

export default function SettingsPage() {
  const { t } = useLanguage()
  const [formData, setFormData] = useState({
    school_name: 'Davomat 1.0 Maktabi',
    class_start_time: '08:30',
    late_threshold_minutes: 15,
    qr_token_ttl_seconds: 30
  })
  
  const [saveLoading, setSaveLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Fetch current settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings')
        const data = await res.json()
        if (res.ok && data) {
          setFormData({
            school_name: data.school_name || 'Davomat 1.0 Maktabi',
            class_start_time: data.class_start_time || '08:30',
            late_threshold_minutes: parseInt(data.late_threshold_minutes || '15', 10),
            qr_token_ttl_seconds: parseInt(data.qr_token_ttl_seconds || '30', 10)
          })
        }
      } catch (err) {
        console.error('Sozlamalarni yuklashda xatolik:', err)
      }
    }
    fetchSettings()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Xatolik yuz berdi.' })
        return
      }

      setMessage({ type: 'success', text: t('settingsSaved') })
      setTimeout(() => setMessage(null), 3000)
    } catch {
      setMessage({ type: 'error', text: 'Server bilan aloqa uzildi.' })
    } finally {
      setSaveLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{t('settings')}</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">{t('schoolSettings')}</p>
      </div>

      {/* Message alert */}
      {message && (
        <div className={`p-4 rounded-xl border flex items-center gap-2.5 text-sm font-medium ${
          message.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400' 
            : 'bg-rose-50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400'
        }`}>
          {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm space-y-6">
        
        {/* Section: School info */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <School className="w-4 h-4 text-slate-400" />
            {t('schoolSettings')}
          </h2>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">{t('schoolName')}</label>
            <input
              type="text"
              required
              value={formData.school_name}
              onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
              placeholder="masalan: 12-sonli umumiy o'rta maktab"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium"
            />
          </div>
        </div>

        {/* Section: Attendance thresholds */}
        <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800/80">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            {t('classStartTime')}
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">{t('classStartTime')}</label>
              <input
                type="time"
                required
                value={formData.class_start_time}
                onChange={(e) => setFormData({ ...formData, class_start_time: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">{t('lateThresholdMin')}</label>
              <input
                type="number"
                required
                min="0"
                max="120"
                value={formData.late_threshold_minutes}
                onChange={(e) => setFormData({ ...formData, late_threshold_minutes: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium"
              />
            </div>
          </div>
        </div>

        {/* Section: Permanent QR */}
        <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800/80">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <QrCode className="w-4 h-4 text-slate-400" />
            QR
          </h2>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Har bir o&apos;quvchiga <strong className="text-slate-900 dark:text-white">doimiy QR kod</strong> beriladi.
            Import qilinganda kodlar Student ID nomli PNG fayllar sifatida ZIP arxivda yuklab olinadi.
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="submit"
            disabled={saveLoading}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 font-bold text-white transition-all shadow-lg shadow-blue-600/20 text-sm hover:-translate-y-0.5 cursor-pointer"
          >
            {saveLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> {t('loading')}
              </>
            ) : (
              <>
                <Check className="w-4 h-4" /> {t('saveSettings')}
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  )
}
