'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Users, 
  CheckCircle, 
  XCircle, 
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  QrCode,
  Check,
  ArrowDownToLine
} from 'lucide-react'

import { useLanguage } from '@/lib/i18n/LanguageContext'
import { fastFetch, invalidateClientCache, getSyncCachedData } from '@/lib/client-cache'
import { cacheStudentsLocally, deleteStudentLocally } from '@/lib/offline-db'

interface Student {
  id: string
  student_code: string
  first_name: string
  last_name: string
  class_id: string | null
  class_name: string | null
  phone: string | null
  parent_phone: string | null
  status: 'active' | 'inactive'
}

interface ClassOption {
  id: string
  name: string
}

interface ImportSummary {
  total: number
  success: number
  failed: number
  failed_rows: Array<{ row: number; student_code: string; reason: string }>
  missing_photos: string[]
  credentials: Array<{ student_code: string; full_name: string; login: string; password: string }>
  qr_students: Array<{ id: string; student_code: string }>
}

interface CreatedStudentQr {
  id: string
  student_code: string
  first_name: string
  last_name: string
  class_name?: string
}

export default function StudentsPage() {
  const { t } = useLanguage()
  
  // Instant 0ms cached initial states
  const cachedStudents = typeof window !== 'undefined' ? getSyncCachedData<{ data: Student[], total?: number, totalPages?: number }>('/api/students') : null
  const cachedClasses = typeof window !== 'undefined' ? getSyncCachedData<{ data: ClassOption[] }>('/api/classes') : null

  // Lists & data
  const [students, setStudents] = useState<Student[]>(() => cachedStudents?.data || [])
  const [classes, setClasses] = useState<ClassOption[]>(() => cachedClasses?.data || [])
  const [loading, setLoading] = useState(() => !cachedStudents)

  // Filters & pagination
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(() => cachedStudents?.totalPages || 1)
  const [totalStudents, setTotalStudents] = useState(() => cachedStudents?.total || 0)

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  
  // Created Student QR Modal (shows permanent QR code download instead of password)
  const [createdStudentQr, setCreatedStudentQr] = useState<CreatedStudentQr | null>(null)

  // Import states
  const fileInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)
  const [importExcel, setImportExcel] = useState<File | null>(null)
  const [importZip, setImportZip] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [qrZipLoading, setQrZipLoading] = useState(false)

  // Form states
  const [formData, setFormData] = useState({
    id: '',
    student_code: '',
    first_name: '',
    last_name: '',
    class_id: '',
    phone: '',
    parent_phone: '',
    status: 'active'
  })
  const [submitLoading, setSubmitLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [codeLoading, setCodeLoading] = useState(false)

  // Debounce search
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch initial data
  useEffect(() => {
    fetchClasses()
    fetchStudents()
  }, [])

  // Trigger fetch when filter changes
  useEffect(() => {
    fetchStudents()
  }, [page, classFilter, statusFilter])

  const fetchClasses = async () => {
    try {
      const data = await fastFetch('/api/classes')
      if (data && data.data) {
        setClasses(data.data)
      }
    } catch (err) {
      console.error('Sinflarni yuklashda xatolik:', err)
    }
  }

  const fetchStudents = async (querySearch?: string) => {
    const searchQuery = querySearch !== undefined ? querySearch : search
    const params = new URLSearchParams({
      page: page.toString(),
      limit: '10',
      search: searchQuery,
      class_id: classFilter,
      status: statusFilter
    })

    try {
      const data = await fastFetch(`/api/students?${params}`)
      if (data && data.data) {
        setStudents(data.data)
        setTotalPages(data.totalPages || 1)
        setTotalStudents(data.total || 0)
      }
    } catch (err) {
      console.error('O\'quvchilarni yuklashda xatolik:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1)
      fetchStudents(value)
    }, 250)
  }

  // Fetch next sequential student code from server (ST001 → ST002 → ...)
  const fetchNextStudentCode = async (): Promise<string> => {
    try {
      const res = await fetch('/api/students/next-code')
      const data = await res.json()
      return data.next_code || 'ST001'
    } catch {
      return 'ST001'
    }
  }

  // Modal Triggers (instant UI response)
  const openAddModal = async () => {
    // Open modal immediately
    setFormData({
      id: '',
      student_code: '',
      first_name: '',
      last_name: '',
      class_id: '',
      phone: '',
      parent_phone: '',
      status: 'active'
    })
    setFormError(null)
    setCodeLoading(true)
    setIsAddModalOpen(true)
    // Fetch real sequential code, show loader while waiting
    const nextCode = await fetchNextStudentCode()
    setFormData(prev => ({ ...prev, student_code: nextCode }))
    setCodeLoading(false)
  }


  const openEditModal = (student: Student) => {
    setFormData({
      id: student.id,
      student_code: student.student_code,
      first_name: student.first_name,
      last_name: student.last_name,
      class_id: student.class_id || '',
      phone: student.phone || '',
      parent_phone: student.parent_phone || '',
      status: student.status
    })
    setFormError(null)
    setIsEditModalOpen(true)
  }

  const openDeleteModal = (student: Student) => {
    setFormData({
      ...formData,
      id: student.id,
      first_name: student.first_name,
      last_name: student.last_name
    })
    setIsDeleteModalOpen(true)
  }

  // Handlers with Instant 0ms Optimistic UI Updates
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const tempId = crypto.randomUUID()
    const selectedClass = classes.find(c => c.id === formData.class_id)?.name

    const optimisticStudent: Student = {
      id: tempId,
      student_code: formData.student_code.trim(),
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      class_id: formData.class_id || null,
      class_name: selectedClass || null,
      phone: formData.phone || null,
      parent_phone: formData.parent_phone || null,
      status: formData.status as 'active' | 'inactive'
    }

    // 1. INSTANT 0ms OPTIMISTIC UPDATE
    setStudents(prev => [optimisticStudent, ...prev])
    setTotalStudents(prev => prev + 1)
    setIsAddModalOpen(false)

    // Save to local IndexedDB immediately
    cacheStudentsLocally([optimisticStudent])

    // Show QR modal immediately
    setCreatedStudentQr({
      id: tempId,
      student_code: optimisticStudent.student_code,
      first_name: optimisticStudent.first_name,
      last_name: optimisticStudent.last_name,
      class_name: selectedClass
    })

    // 2. BACKGROUND SERVER SYNC
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      
      if (res.ok && data.student) {
        invalidateClientCache('/api/students')
        invalidateClientCache('/api/attendance')
        invalidateClientCache('/api/classes')
        // Update temporary ID with real database ID
        setStudents(prev => prev.map(s => s.id === tempId ? { ...s, id: data.student.id } : s))
        cacheStudentsLocally([{ ...optimisticStudent, id: data.student.id }])
      } else if (!res.ok) {
        // Rollback if server rejected
        setStudents(prev => prev.filter(s => s.id !== tempId))
        setTotalStudents(prev => prev - 1)
        deleteStudentLocally(tempId)
        alert(data.error || 'O\'quvchi qo\'shishda xatolik yuz berdi.')
      }
    } catch {
      // Keep in local offline database — will sync later
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const selectedClass = classes.find(c => c.id === formData.class_id)?.name

    const updatedStudent: Student = {
      id: formData.id,
      student_code: formData.student_code.trim(),
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      class_id: formData.class_id || null,
      class_name: selectedClass || null,
      phone: formData.phone || null,
      parent_phone: formData.parent_phone || null,
      status: formData.status as 'active' | 'inactive'
    }

    // 1. INSTANT 0ms OPTIMISTIC UPDATE
    setStudents(prev => prev.map(s => s.id === formData.id ? updatedStudent : s))
    setIsEditModalOpen(false)

    // Save to local IndexedDB immediately
    cacheStudentsLocally([updatedStudent])
    invalidateClientCache('/api/students')
    invalidateClientCache('/api/attendance')
    invalidateClientCache('/api/classes')

    // 2. BACKGROUND SERVER SYNC
    try {
      const res = await fetch(`/api/students/${formData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        invalidateClientCache('/api/students')
        invalidateClientCache('/api/attendance')
        invalidateClientCache('/api/classes')
      }
    } catch {
      // Saved locally
    }
  }

  const handleDeleteSubmit = async () => {
    const targetId = formData.id

    // 1. INSTANT 0ms OPTIMISTIC UPDATE
    setStudents(prev => prev.filter(s => s.id !== targetId))
    setTotalStudents(prev => Math.max(0, prev - 1))
    setIsDeleteModalOpen(false)

    // Delete from local IndexedDB immediately
    deleteStudentLocally(targetId)
    invalidateClientCache('/api/students')
    invalidateClientCache('/api/attendance')
    invalidateClientCache('/api/classes')

    // 2. BACKGROUND SERVER SYNC
    try {
      const res = await fetch(`/api/students/${targetId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        invalidateClientCache('/api/students')
        invalidateClientCache('/api/attendance')
        invalidateClientCache('/api/classes')
      }
    } catch {
      // Handled locally
    }
  }

  // Excel template download
  const handleDownloadTemplate = () => {
    window.open('/api/students/import-template', '_blank')
  }

  // Excel Export
  const handleExportStudents = () => {
    window.open('/api/students/export', '_blank')
  }

  // Import Submission with instant local caching and immediate refresh
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!importExcel) {
      setImportError('Excel shablonini tanlash shart.')
      return
    }

    setImportLoading(true)
    setImportError(null)
    setImportSummary(null)

    const data = new FormData()
    data.append('file', importExcel)
    if (importZip) {
      data.append('zip', importZip)
    }

    try {
      const res = await fetch('/api/students/import', {
        method: 'POST',
        body: data
      })
      const result = await res.json()

      if (!res.ok) {
        setImportError(result.error || 'Import qilishda xatolik yuz berdi.')
        return
      }

      setImportSummary(result)
      invalidateClientCache('/api/students')
      invalidateClientCache('/api/classes')

      // Fetch fresh data immediately
      await fetchClasses()
      await fetchStudents()

      // Automatically trigger QR Zip download
      if (result.qr_students?.length) {
        downloadQrZip(result.qr_students)
      }
    } catch (err) {
      setImportError('Serverga bog\'lanib bo\'lmadi.')
    } finally {
      setImportLoading(false)
    }
  }

  // Download all database QR codes as ZIP
  const downloadQrZip = async (specificStudents?: Array<{ id: string; student_code: string }>, all = true) => {
    setQrZipLoading(true)
    try {
      const res = await fetch('/api/students/qr/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(specificStudents ? { students: specificStudents } : { all: true })
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'QR kodlarni yuklab olishda xatolik yuz berdi.')
        return
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'barcha_student_qr_kodlari.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('QR kodlar arxivini yuklab olishda xatolik yuz berdi.')
    } finally {
      setQrZipLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{t('students')}</h1>
        </div>
        
        {/* Button Actions Group */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold transition-all text-sm cursor-pointer shadow-sm active:scale-95"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            {t('importExcel')}
          </button>
          
          <button
            onClick={handleExportStudents}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold transition-all text-sm cursor-pointer shadow-sm active:scale-95"
          >
            <Download className="w-4 h-4 text-slate-500" />
            {t('exportExcel')}
          </button>

          <button
            onClick={() => downloadQrZip(undefined, true)}
            disabled={qrZipLoading}
            title="Baza bo'yicha barcha o'quvchilar QR kodlarini ZIP qilib yuklab olish"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold transition-all text-sm cursor-pointer shadow-sm disabled:opacity-60 active:scale-95"
          >
            {qrZipLoading ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> : <QrCode className="w-4 h-4 text-blue-600" />}
            <span>{t('allQrZip')}</span>
          </button>

          <button 
            onClick={openAddModal}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-lg shadow-blue-600/20 text-sm hover:-translate-y-0.5 cursor-pointer active:scale-95"
          >
            <Plus className="w-5 h-5" />
            {t('newStudent')}
          </button>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-6 shadow-sm flex flex-col md:flex-row items-center gap-4">
        {/* Search */}
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder={t('search')}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
          />
        </div>

        {/* Class Filter */}
        <div className="w-full md:w-48">
          <select
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value)
              setPage(1)
            }}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm cursor-pointer"
          >
            <option value="">{t('allClasses')}</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-full md:w-44">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm cursor-pointer"
          >
            <option value="">{t('allStatuses')}</option>
            <option value="active">{t('active')}</option>
            <option value="inactive">{t('inactive')}</option>
          </select>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">{t('lastName')} / {t('firstName')}</th>
                <th className="px-6 py-4">{t('studentId')}</th>
                <th className="px-6 py-4">{t('class')}</th>
                <th className="px-6 py-4">{t('phone')}</th>
                <th className="px-6 py-4">{t('status')}</th>
                <th className="px-6 py-4 text-right">{t('actions')} & QR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2" />
                    <span>Yuklanmoqda...</span>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                    <Users className="w-12 h-12 stroke-1 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">Hech qanday o&apos;quvchi topilmadi</p>
                    <p className="text-xs text-slate-400 mt-1">Filtrlarni tozalang yoki yangi o&apos;quvchi qo&apos;shing</p>
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                          {student.first_name[0]}{student.last_name[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {student.last_name} {student.first_name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">
                      {student.student_code}
                    </td>
                    <td className="px-6 py-4">
                      {student.class_name ? (
                        <span className="inline-flex px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-xs font-semibold">
                          {student.class_name}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">Biriktirilmagan</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {student.phone || '—'}
                    </td>
                    <td className="px-6 py-4">
                      {student.status === 'active' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                          <CheckCircle className="w-3.5 h-3.5" /> Faol
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                          <XCircle className="w-3.5 h-3.5" /> Nofaol
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Direct QR Download */}
                        <a
                          href={`/api/students/${student.id}/qr`}
                          download={`${student.student_code}_qr.png`}
                          title="QR kodni yuklab olish (PNG)"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>QR</span>
                        </a>

                        <button
                          onClick={() => openEditModal(student)}
                          title="Tahrirlash"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(student)}
                          title="O'chirish"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Jami {totalStudents} ta o&apos;quvchidan {(page - 1) * 10 + 1}–{Math.min(page * 10, totalStudents)} ko&apos;rsatilmoqda
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 1. EXCEL IMPORT MODAL */}
      {/* ============================================================ */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-bold text-slate-900 dark:text-white text-lg">Excel orqali o&apos;quvchilarni yuklash</h2>
              <button onClick={() => setIsImportModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {importSummary ? (
              /* Success Summary view */
              <div className="p-6 space-y-5">
                <div className="text-center p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                  <CheckCircle className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-lg">Import muvaffaqiyatli yakunlandi!</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Jami <strong>{importSummary.total}</strong> ta o&apos;quvchidan <strong>{importSummary.success}</strong> tasi saqlandi va QR kodlari generatsiya qilindi.
                  </p>
                  {importSummary.failed > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      {importSummary.failed} ta qatorda xatolik bo&apos;ldi.
                    </p>
                  )}
                </div>

                {/* QR Zip action button */}
                {importSummary.qr_students?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => downloadQrZip(importSummary.qr_students)}
                    disabled={qrZipLoading}
                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-600/20 active:scale-95 cursor-pointer"
                  >
                    {qrZipLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>QR kodlar tayyorlanmoqda...</span>
                      </>
                    ) : (
                      <>
                        <ArrowDownToLine className="w-4 h-4" />
                        <span>QR Kodlar arxivini yuklab olish (.zip)</span>
                      </>
                    )}
                  </button>
                )}

                <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setIsImportModalOpen(false)
                      setImportSummary(null)
                      setImportExcel(null)
                      setImportZip(null)
                    }}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-850 text-white text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Tayyor (Ro&apos;yxatni ko&apos;rish)
                  </button>
                </div>
              </div>
            ) : (
              /* Upload files Form view */
              <form onSubmit={handleImportSubmit} className="p-6 space-y-5">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-850 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">Excel Shablon</p>
                      <p className="text-xs text-slate-400">Avval bo&apos;sh shablonni yuklab oling</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Shablon yuklash
                  </button>
                </div>

                {/* Excel Upload Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Excel faylni yuklang (.xlsx)*</label>
                  <input
                    type="file"
                    required
                    accept=".xlsx"
                    ref={fileInputRef}
                    onChange={(e) => setImportExcel(e.target.files?.[0] || null)}
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-950/30 dark:file:text-blue-400 cursor-pointer"
                  />
                </div>

                {/* Photos Zip Upload Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Rasmlar arxivi (.zip - ixtiyoriy)</label>
                  <input
                    type="file"
                    accept=".zip"
                    ref={zipInputRef}
                    onChange={(e) => setImportZip(e.target.files?.[0] || null)}
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-950/30 dark:file:text-blue-400 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 leading-normal">
                    Arxiv ichidagi rasmlar nomi mos Student ID bilan bir xil bo&apos;lishi shart (masalan, ST0001.jpg, ST0002.jpg).
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    disabled={importLoading || !importExcel}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-600/10 cursor-pointer"
                  >
                    {importLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Yuklanmoqda...
                      </>
                    ) : (
                      'Yuklashni boshlash'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. ADD STUDENT MODAL */}
      {/* ============================================================ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-bold text-slate-900 dark:text-white text-lg">Yangi o&apos;quvchi qo&apos;shish</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="m-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ism</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="Ali"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Familiya</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    placeholder="Valiyev"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Student ID</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={formData.student_code}
                      onChange={(e) => setFormData({ ...formData, student_code: e.target.value })}
                      placeholder="ST001"
                      disabled={codeLoading}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-mono pr-10 disabled:opacity-60"
                    />
                    {codeLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sinf</label>
                  <select
                    value={formData.class_id}
                    onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
                  >
                    <option value="">Tanlang</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Telefoni</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+998901234567"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ota-onasi telefoni</label>
                  <input
                    type="text"
                    value={formData.parent_phone}
                    onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                    placeholder="+998901234567"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-600/10 cursor-pointer"
                >
                  {submitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Saqlash va QR yaratish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. EDIT STUDENT MODAL */}
      {/* ============================================================ */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-bold text-slate-900 dark:text-white text-lg">O&apos;quvchini tahrirlash</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="m-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ism</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Familiya</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Student ID (O&apos;zgartirib bo&apos;lmaydi)</label>
                  <input
                    type="text"
                    disabled
                    value={formData.student_code}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 opacity-60 text-sm font-mono cursor-not-allowed"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sinf</label>
                  <select
                    value={formData.class_id}
                    onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
                  >
                    <option value="">Tanlang</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Telefoni</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ota-onasi telefoni</label>
                  <input
                    type="text"
                    value={formData.parent_phone}
                    onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Holati</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="active"
                      checked={formData.status === 'active'}
                      onChange={() => setFormData({ ...formData, status: 'active' })}
                      className="accent-blue-600"
                    />
                    Faol
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="inactive"
                      checked={formData.status === 'inactive'}
                      onChange={() => setFormData({ ...formData, status: 'inactive' })}
                      className="accent-blue-600"
                    />
                    Nofaol
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-600/10 cursor-pointer"
                >
                  {submitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yangilash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. DELETE CONFIRMATION MODAL */}
      {/* ============================================================ */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-100">
            <div className="p-6">
              <div className="flex items-center gap-3 text-rose-600 mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center shadow-inner">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-slate-900 dark:text-white text-lg">O&apos;quvchini o&apos;chirish</h2>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">
                Haqiqatan ham o&apos;quvchi <strong className="text-slate-900 dark:text-white">{formData.last_name} {formData.first_name}</strong> ni o&apos;chirmoqchimisiz? Ushbu amalni ortga qaytarib bo&apos;lmaydi.
              </p>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                onClick={handleDeleteSubmit}
                disabled={submitLoading}
                className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-all shadow-lg shadow-rose-600/10 cursor-pointer"
              >
                {submitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ha, o\'chirish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. NEW STUDENT QR CODE PRESENTATION & DOWNLOAD MODAL */}
      {/* ============================================================ */}
      {createdStudentQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative p-6 text-center text-slate-900 dark:text-white">
            
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 mb-4 shadow-inner">
              <CheckCircle className="w-6 h-6" />
            </div>

            <h2 className="text-xl font-bold tracking-tight mb-1">O&apos;quvchi yaratildi!</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-5">
              Doimiy universal QR kodi tayyorlandi.
            </p>

            {/* QR Display Card */}
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-2xl p-5 mb-5 flex flex-col items-center">
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 mb-3">
                <img 
                  src={`/api/students/${createdStudentQr.id}/qr`} 
                  alt="Student QR Code"
                  className="w-44 h-44 object-contain"
                />
              </div>

              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {createdStudentQr.first_name} {createdStudentQr.last_name}
              </h3>
              <p className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                ID: {createdStudentQr.student_code} {createdStudentQr.class_name ? `• ${createdStudentQr.class_name}` : ''}
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-2.5">
              <a
                href={`/api/students/${createdStudentQr.id}/qr`}
                download={`${createdStudentQr.student_code}_qr.png`}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-600/20 active:scale-95 cursor-pointer"
              >
                <ArrowDownToLine className="w-4 h-4" />
                <span>QR Kodni Yuklab Olish (PNG)</span>
              </a>

              <button
                onClick={() => setCreatedStudentQr(null)}
                className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium text-sm transition-colors cursor-pointer"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
