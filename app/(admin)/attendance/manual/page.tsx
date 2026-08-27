'use client'

import { useState, useEffect } from 'react'
import { 
  Calendar as CalendarIcon, 
  School, 
  Check, 
  AlertCircle,
  Clock,
  UserCheck,
  UserX,
  Plus,
  Loader2,
  FileSpreadsheet
} from 'lucide-react'

interface Student {
  id: string
  student_code: string
  first_name: string
  last_name: string
  class_id: string | null
}

interface ClassOption {
  id: string
  name: string
}

interface AttendanceState {
  [studentId: string]: 'present' | 'absent' | 'late' | 'excused'
}

export default function ManualAttendancePage() {
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  
  // Default date to today's local date (Uzbekistan UTC+5)
  const getTodayUzDate = () => {
    const now = new Date()
    const nowUz = new Date(now.getTime() + 5 * 60 * 60 * 1000)
    return nowUz.toISOString().split('T')[0]
  }
  const [selectedDate, setSelectedDate] = useState(getTodayUzDate())
  
  const [students, setStudents] = useState<Student[]>([])
  const [attendance, setAttendance] = useState<AttendanceState>({})
  const [loading, setLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Fetch classes
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await fetch('/api/classes')
        const data = await res.json()
        if (data.data && data.data.length > 0) {
          setClasses(data.data)
          setSelectedClassId(data.data[0].id)
        }
      } catch (err) {
        console.error('Sinflarni yuklashda xatolik:', err)
      }
    }
    fetchClasses()
  }, [])

  // Fetch class students and existing attendance when class or date changes
  useEffect(() => {
    if (!selectedClassId || !selectedDate) return

    const fetchData = async () => {
      setLoading(true)
      setMessage(null)
      try {
        // 1. Fetch class students
        const resStudents = await fetch(`/api/students?class_id=${selectedClassId}&limit=1000`)
        const dataStudents = await resStudents.json()
        const studentsList = dataStudents.data || []
        setStudents(studentsList)

        // 2. Fetch existing attendance for this class and date
        const resAttendance = await fetch(`/api/attendance/history?class_id=${selectedClassId}&date=${selectedDate}&limit=1000`)
        const dataAttendance = await resAttendance.json()
        const attendanceList = dataAttendance.data || []

        // 3. Merge attendance states
        const initialAttendance: AttendanceState = {}
        
        // Default all students to 'absent' if no attendance exists yet
        studentsList.forEach((student: Student) => {
          initialAttendance[student.id] = 'absent'
        })

        // Override with existing database records
        attendanceList.forEach((rec: any) => {
          initialAttendance[rec.student_id] = rec.status
        })

        setAttendance(initialAttendance)
      } catch (err) {
        console.error('Ma\'lumotlarni yuklashda xatolik:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedClassId, selectedDate])

  const handleStatusChange = (studentId: string, status: 'present' | 'absent' | 'late' | 'excused') => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: status
    }))
  }

  // Set all students to a specific status in bulk
  const handleBulkStatusChange = (status: 'present' | 'absent' | 'late' | 'excused') => {
    const updated: AttendanceState = {}
    students.forEach((student) => {
      updated[student.id] = status
    })
    setAttendance(updated)
  }

  const handleSave = async () => {
    setSaveLoading(true)
    setMessage(null)

    // Format body payload as array of objects
    const payload = Object.entries(attendance).map(([studentId, status]) => ({
      student_id: studentId,
      status,
      date: selectedDate
    }))

    try {
      const res = await fetch('/api/attendance/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Saqlashda xatolik yuz berdi.' })
        return
      }

      setMessage({ type: 'success', text: 'Davomat muvaffaqiyatli saqlandi!' })
      // Smooth clear message
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      setMessage({ type: 'error', text: 'Server bilan aloqa uzildi.' })
    } finally {
      setSaveLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Qo&apos;lda davomat yuritish</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Sinf o&apos;quvchilari uchun davomatni qo&apos;lda kiritish yoki tahrirlash</p>
      </div>

      {/* Selectors card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-6 shadow-sm flex flex-col sm:flex-row items-center gap-4">
        {/* Class select */}
        <div className="w-full sm:flex-1 space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Sinfni tanlang</label>
          <div className="relative">
            <School className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name} sinfi</option>
              ))}
            </select>
          </div>
        </div>

        {/* Date input */}
        <div className="w-full sm:w-64 space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Sana</label>
          <div className="relative">
            <CalendarIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium"
            />
          </div>
        </div>
      </div>

      {/* Main Body */}
      {selectedClassId && (
        <div className="space-y-6">
          
          {/* Notification Messages */}
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

          {/* Bulk Action Controls */}
          {students.length > 0 && !loading && (
            <div className="bg-slate-100 dark:bg-slate-850 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hamma o&apos;quvchilarni belgilash:</span>
              <div className="flex gap-2">
                {[
                  { status: 'present', label: 'Keldi', color: 'emerald' },
                  { status: 'late', label: 'Kechikdi', color: 'yellow' },
                  { status: 'absent', label: 'Kelmidi', color: 'rose' },
                  { status: 'excused', label: 'Sababli', color: 'blue' }
                ].map((btn) => (
                  <button
                    key={btn.status}
                    onClick={() => handleBulkStatusChange(btn.status as any)}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Table / List Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="py-24 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-2" />
                <span className="text-slate-400 text-sm">Yuklanmoqda...</span>
              </div>
            ) : students.length === 0 ? (
              <div className="py-20 text-center text-slate-400">
                Ushbu sinfda o&apos;quvchilar topilmadi.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {students.map((student) => {
                  const currentStatus = attendance[student.id] || 'absent'
                  return (
                    <div 
                      key={student.id} 
                      className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-50/30 dark:hover:bg-slate-800/10 transition-colors"
                    >
                      {/* Student Info */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-950 flex items-center justify-center font-bold text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-850 shadow-inner">
                          {student.first_name[0]}{student.last_name[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white leading-normal">
                            {student.last_name} {student.first_name}
                          </p>
                          <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                            ID: {student.student_code}
                          </p>
                        </div>
                      </div>

                      {/* Manual Radio Status Selection */}
                      <div className="flex flex-wrap items-center gap-2">
                        {[
                          { status: 'present', label: 'Keldi', color: 'emerald' },
                          { status: 'late', label: 'Kechikdi', color: 'yellow' },
                          { status: 'absent', label: 'Kelmidi', color: 'rose' },
                          { status: 'excused', label: 'Sababli', color: 'blue' }
                        ].map((option) => {
                          const isSelected = currentStatus === option.status
                          let btnStyle = 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'
                          
                          if (isSelected) {
                            if (option.status === 'present') btnStyle = 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-bold'
                            if (option.status === 'late') btnStyle = 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900/40 text-yellow-600 dark:text-yellow-400 font-bold'
                            if (option.status === 'absent') btnStyle = 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 font-bold'
                            if (option.status === 'excused') btnStyle = 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 text-blue-600 dark:text-blue-400 font-bold'
                          }

                          return (
                            <button
                              key={option.status}
                              onClick={() => handleStatusChange(student.id, option.status as any)}
                              className={`px-4 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${btnStyle}`}
                            >
                              {option.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Save Button Bar */}
          {students.length > 0 && !loading && (
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSave}
                disabled={saveLoading}
                className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 font-bold text-white transition-all shadow-lg shadow-blue-600/20 text-sm hover:-translate-y-0.5 cursor-pointer"
              >
                {saveLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saqlanmoqda...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> Davomatni saqlash
                  </>
                )}
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
