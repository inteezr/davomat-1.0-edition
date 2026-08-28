import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import { createServiceClient } from '@/lib/supabase/server'
import { clearStatsCache } from '@/lib/stats-cache'

/**
 * POST /api/attendance/manual
 * Allows admins to manually set or update attendance for students in bulk or individually.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin()
    const body = await request.json()
    const items = Array.isArray(body) ? body : [body]

    if (items.length === 0) {
      return Response.json({ error: 'Davomat ma\'lumotlari yuborilmadi.' }, { status: 400 })
    }

    const validStatuses = ['present', 'absent', 'late', 'excused']
    const studentIds: string[] = []

    for (const item of items) {
      const { student_id, status, date } = item
      if (!student_id || !status || !date) {
        throw new Error('MANDATORY_FIELDS_MISSING')
      }
      if (!validStatuses.includes(status)) {
        throw new Error('INVALID_STATUS')
      }
      studentIds.push(student_id)
    }

    const serviceClient = createServiceClient()

    // 1. Bulk fetch students in a single query
    const { data: students, error: studentError } = await serviceClient
      .from('students')
      .select('id, class_id')
      .eq('school_id', admin.school_id)
      .in('id', Array.from(new Set(studentIds)))

    if (studentError) {
      throw studentError
    }

    const studentMap = new Map<string, { id: string; class_id: string | null }>()
    for (const s of (students || [])) {
      studentMap.set(s.id, s)
    }

    // 2. Prepare bulk rows for single upsert
    const nowIso = new Date().toISOString()
    const rowsToUpsert = items
      .filter(item => studentMap.has(item.student_id))
      .map((item) => {
        const student = studentMap.get(item.student_id)!
        const isPresentOrLate = item.status === 'present' || item.status === 'late'
        return {
          student_id: item.student_id,
          class_id: student.class_id,
          date: item.date,
          status: item.status,
          checked_in_at: isPresentOrLate ? nowIso : null,
          method: 'manual',
          recorded_by: admin.id,
        }
      })

    if (rowsToUpsert.length > 0) {
      const { data: results, error: upsertError } = await serviceClient
        .from('attendance')
        .upsert(rowsToUpsert, { onConflict: 'student_id,date' })
        .select('id, status')

      if (upsertError) throw upsertError

      // Clear memory cache so dashboard reflects updates immediately
      clearStatsCache()

      return Response.json({
        message: 'Davomat muvaffaqiyatli saqlandi.',
        count: results?.length || rowsToUpsert.length
      })
    }

    return Response.json({
      message: 'Hech qanday o\'quvchi yangilanmadi.',
      count: 0
    })

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg === 'MANDATORY_FIELDS_MISSING') {
      return Response.json({ error: 'student_id, status va date yuborilishi shart.' }, { status: 400 })
    }
    if (msg === 'INVALID_STATUS') {
      return Response.json({ error: 'Noto\'g\'ri status yuborildi.' }, { status: 400 })
    }
    return handleApiError(error)
  }
}
