'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { fastFetch, invalidateClientCache, getSyncCachedData } from '@/lib/client-cache'
import { cacheClassesLocally, deleteClassLocally } from '@/lib/offline-db'
import { 
  Plus, Edit, Trash2, School, Users, X, Loader2, XCircle, Phone
} from 'lucide-react'

interface Class {
  id: string
  name: string
  grade: number | null
  student_count: string | number
}

interface ClassStudent {
  id: string
  first_name: string
  last_name: string
  student_code: string
  phone: string | null
  parent_phone: string | null
  avatar_url: string | null
  attendance_status: string | null
  checked_in_at: string | null
}

/** Full-screen portal overlay — renders directly into document.body */
function FullOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{
        top: 0, left: 0, right: 0, bottom: 0,
        width: '100vw', height: '100vh',
        backgroundColor: 'rgba(2,6,23,0.78)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 99999,
      }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  )
}

export default function ClassesPage() {
  const { t } = useLanguage()
  const cached = typeof window !== 'undefined' ? getSyncCachedData<{ data: Class[] }>('/api/classes') : null
  const [classes, setClasses] = useState<Class[]>(() => cached?.data || [])
  const [loading, setLoading] = useState(() => !cached)
  const [mounted, setMounted] = useState(false)

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // Class detail popup
  const [activeClassPopupId, setActiveClassPopupId] = useState<string | null>(null)
  const [classPopupStudents, setClassPopupStudents] = useState<ClassStudent[]>([])
  const [classPopupLoading, setClassPopupLoading] = useState(false)
  const [classPopupClassName, setClassPopupClassName] = useState('')
  const [classPopupSearch, setClassPopupSearch] = useState('')

  // Form
  const [formData, setFormData] = useState({ id: '', name: '' })
  const [submitLoading, setSubmitLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    fetchClasses()
  }, [])

  const fetchClasses = async () => {
    try {
      const data = await fastFetch('/api/classes')
      if (data && data.data) setClasses(data.data)
    } catch (err) {
      console.error('Sinflarni yuklashda xatolik:', err)
    } finally {
      setLoading(false)
    }
  }

  const openClassPopup = async (cls: Class, e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('[data-action]')) return

    setActiveClassPopupId(cls.id)
    setClassPopupClassName(cls.name)
    setClassPopupSearch('')
    try {
      const data = await fastFetch(`/api/attendance/stats/class-students?class_id=${cls.id}`)
      if (data && data.success) {
        setClassPopupStudents(data.students || [])
        setClassPopupClassName(data.className || cls.name)
      }
    } catch (err) {
      console.error('Class popup fetch error:', err)
    } finally {
      setClassPopupLoading(false)
    }
  }

  const openAddModal = () => {
    setFormData({ id: '', name: '' })
    setFormError(null)
    setIsAddModalOpen(true)
  }

  const openEditModal = (cls: Class, e: React.MouseEvent) => {
    e.stopPropagation()
    setFormData({ id: cls.id, name: cls.name })
    setFormError(null)
    setIsEditModalOpen(true)
  }

  const openDeleteModal = (cls: Class, e: React.MouseEvent) => {
    e.stopPropagation()
    setFormData({ id: cls.id, name: cls.name })
    setIsDeleteModalOpen(true)
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const gradeMatch = formData.name.trim().match(/^(\d+)/)
    const grade = gradeMatch ? parseInt(gradeMatch[1], 10) : null
    const tempId = crypto.randomUUID()

    const optimisticClass: Class = {
      id: tempId,
      name: formData.name.trim(),
      grade,
      student_count: 0
    }

    // 1. INSTANT 0ms OPTIMISTIC UPDATE
    setClasses(prev => [...prev, optimisticClass])
    setIsAddModalOpen(false)

    // Save to local IndexedDB immediately
    cacheClassesLocally([optimisticClass])

    // 2. BACKGROUND SERVER SYNC
    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formData.name, grade })
      })
      const data = await res.json()
      if (res.ok && data.data) {
        invalidateClientCache('/api/classes')
        setClasses(prev => prev.map(c => c.id === tempId ? data.data : c))
        cacheClassesLocally([data.data])
      } else if (!res.ok) {
        // Rollback
        setClasses(prev => prev.filter(c => c.id !== tempId))
        deleteClassLocally(tempId)
        alert(data.error || 'Sinf yaratishda xatolik yuz berdi.')
      }
    } catch {
      // Keep in local offline database
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const gradeMatch = formData.name.trim().match(/^(\d+)/)
    const grade = gradeMatch ? parseInt(gradeMatch[1], 10) : null

    // 1. INSTANT 0ms OPTIMISTIC UPDATE
    setClasses(prev => prev.map(c => c.id === formData.id ? { ...c, name: formData.name.trim(), grade } : c))
    setIsEditModalOpen(false)

    // Update in local IndexedDB
    cacheClassesLocally([{ id: formData.id, name: formData.name.trim(), grade }])

    // 2. BACKGROUND SERVER SYNC
    try {
      const res = await fetch(`/api/classes/${formData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formData.name, grade })
      })
      if (res.ok) {
        invalidateClientCache('/api/classes')
      }
    } catch {
      // Saved locally
    }
  }

  const handleDeleteSubmit = async () => {
    const targetId = formData.id

    // 1. INSTANT 0ms OPTIMISTIC UPDATE
    setClasses(prev => prev.filter(c => c.id !== targetId))
    setIsDeleteModalOpen(false)

    // Delete from local IndexedDB
    deleteClassLocally(targetId)

    // 2. BACKGROUND SERVER SYNC
    try {
      const res = await fetch(`/api/classes/${targetId}`, { method: 'DELETE' })
      if (res.ok) {
        invalidateClientCache('/api/classes')
      }
    } catch {
      // Handled locally
    }
  }

  const filteredStudents = classPopupStudents.filter(s => {
    const q = classPopupSearch.toLowerCase()
    return (
      `${s.last_name} ${s.first_name}`.toLowerCase().includes(q) ||
      (s.student_code || '').toLowerCase().includes(q) ||
      (s.phone || '').includes(q)
    )
  })

  const presentCount = classPopupStudents.filter(s => s.attendance_status === 'present' || s.attendance_status === 'late').length
  const absentCount  = classPopupStudents.filter(s => !s.attendance_status).length

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{t('classes')}</h1>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-lg shadow-blue-600/20 text-sm hover:-translate-y-0.5 cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          {t('newClass')}
        </button>
      </div>

      {/* Class Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 text-slate-400">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-2" />
          <span>{t('loading')}</span>
        </div>
      ) : classes.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-16 text-center text-slate-400 shadow-sm">
          {t('notFound')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {classes.map((cls) => (
            <div
              key={cls.id}
              onClick={(e) => openClassPopup(cls, e)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group cursor-pointer hover:border-blue-300 dark:hover:border-blue-800"
            >
              <div className="absolute inset-0 bg-blue-500/[0.03] opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />

              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors">
                  <School className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    data-action="edit"
                    onClick={(e) => openEditModal(cls, e)}
                    title={t('edit')}
                    className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    data-action="delete"
                    onClick={(e) => openDeleteModal(cls, e)}
                    title={t('delete')}
                    className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {cls.name}
              </h3>

              <div className="flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-slate-500 dark:text-slate-400">
                <Users className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium">{cls.student_count} {t('activeStudentsCount')}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== ADD MODAL ===== */}
      {mounted && isAddModalOpen && (
        <FullOverlay onClose={() => setIsAddModalOpen(false)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-bold text-slate-900 dark:text-white text-lg">{t('newClass')}</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            {formError && (
              <div className="m-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{formError}</div>
            )}
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('className')}</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('classPlaceholder')}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                  {t('cancel')}
                </button>
                <button type="submit" disabled={submitLoading} className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-600/10 cursor-pointer">
                  {submitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('save')}
                </button>
              </div>
            </form>
          </div>
        </FullOverlay>
      )}

      {/* ===== EDIT MODAL ===== */}
      {mounted && isEditModalOpen && (
        <FullOverlay onClose={() => setIsEditModalOpen(false)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-bold text-slate-900 dark:text-white text-lg">{t('edit')}</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            {formError && (
              <div className="m-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{formError}</div>
            )}
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('className')}</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                  {t('cancel')}
                </button>
                <button type="submit" disabled={submitLoading} className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-600/10 cursor-pointer">
                  {submitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('save')}
                </button>
              </div>
            </form>
          </div>
        </FullOverlay>
      )}

      {/* ===== DELETE MODAL ===== */}
      {mounted && isDeleteModalOpen && (
        <FullOverlay onClose={() => setIsDeleteModalOpen(false)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6">
              <div className="flex items-center gap-3 text-rose-600 mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-slate-900 dark:text-white text-lg">{t('delete')}</h2>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">
                <strong className="text-slate-900 dark:text-white">{formData.name}</strong> {t('deleteClassConfirm')}
              </p>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                {t('cancel')}
              </button>
              <button onClick={handleDeleteSubmit} disabled={submitLoading} className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-all shadow-lg shadow-rose-600/10 cursor-pointer">
                {submitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('yesDelete')}
              </button>
            </div>
          </div>
        </FullOverlay>
      )}

      {/* ===== CLASS DETAIL POPUP ===== */}
      {mounted && activeClassPopupId && (
        <FullOverlay onClose={() => setActiveClassPopupId(null)}>
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full overflow-hidden flex flex-col shadow-2xl relative"
            style={{ maxHeight: '85vh', width: 'min(92vw, 1200px)' }}
          >
            {/* Close */}
            <button
              onClick={() => setActiveClassPopupId(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors z-10 cursor-pointer"
            >
              <XCircle className="w-6 h-6" />
            </button>

            {/* Header */}
            <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 bg-blue-50/60 dark:bg-blue-950/20 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-2xl shrink-0">🏫</div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {classPopupClassName} {t('class')}
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {t('totalCount')}: <span className="font-semibold text-slate-700 dark:text-slate-300">{classPopupStudents.length}</span> {t('studentsCount')}
                    {!classPopupLoading && (
                      <span className="ml-3">
                        · <span className="text-emerald-600 font-semibold">{presentCount}</span> {t('present')}
                        · <span className="text-slate-400 font-semibold">{absentCount}</span> {t('absent')}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="px-8 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <input
                type="text"
                placeholder={t('searchInClass')}
                value={classPopupSearch}
                onChange={(e) => setClassPopupSearch(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                autoFocus
              />
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto">
              {classPopupLoading ? (
                <div className="h-48 flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                  <span>{t('loading')}</span>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                  {t('notFound')}
                </div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700">
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-10">#</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">{t('photo')}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('studentId')}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('lastName')}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('firstName')}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('phone')}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('parentPhone')}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredStudents.map((student, idx) => {
                      const statusLabel =
                        student.attendance_status === 'present' ? { label: t('present'), cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' } :
                        student.attendance_status === 'late'    ? { label: t('late'),    cls: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' } :
                        student.attendance_status === 'excused' ? { label: `📋 ${t('excused')}`, cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800' } :
                                                                  { label: t('absent'),  cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' }
                      return (
                        <tr key={student.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-950/10 transition-colors">

                          {/* # */}
                          <td className="px-4 py-3 text-center text-xs text-slate-400 font-mono">{idx + 1}</td>

                          {/* Rasm */}
                          <td className="px-4 py-3 text-center">
                            {student.avatar_url ? (
                              <img
                                src={student.avatar_url}
                                alt=""
                                className="w-9 h-9 rounded-xl object-cover mx-auto ring-2 ring-slate-100 dark:ring-slate-700"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-xs mx-auto">
                                {student.first_name?.[0]}{student.last_name?.[0]}
                              </div>
                            )}
                          </td>

                          {/* Student ID */}
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                              {student.student_code}
                            </span>
                          </td>

                          {/* Familiya */}
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{student.last_name}</td>

                          {/* Ism */}
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{student.first_name}</td>

                          {/* Telefon */}
                          <td className="px-4 py-3">
                            {student.phone ? (
                              <a
                                href={`tel:${student.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                              >
                                <Phone className="w-3 h-3 shrink-0" />
                                {student.phone}
                              </a>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">—</span>
                            )}
                          </td>

                          {/* Ota-ona tel. */}
                          <td className="px-4 py-3">
                            {student.parent_phone ? (
                              <a
                                href={`tel:${student.parent_phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:underline whitespace-nowrap"
                              >
                                <Phone className="w-3 h-3 shrink-0" />
                                {student.parent_phone}
                              </a>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">—</span>
                            )}
                          </td>

                          {/* Holat */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusLabel.cls}`}>
                              {statusLabel.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="px-8 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center shrink-0">
              <span className="text-xs text-slate-400">
                {filteredStudents.length} {t('studentsCount')}
              </span>
              <button
                onClick={() => setActiveClassPopupId(null)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </FullOverlay>
      )}
    </div>
  )
}
