import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import { createServiceClient } from '@/lib/supabase/server'
import { clearStatsCache } from '@/lib/stats-cache'

/**
 * PATCH /api/attendance/excuse
 * Marks a student as "excused" for today (or a given date) in the attendance table.
 * Body: { student_id: string, reason?: string, date?: string (YYYY-MM-DD) }
 */
export async function PATCH(request: NextRequest) {
  try {
    const admin = await verifyAdmin()
    const body = await request.json()
    const { student_id, reason, date } = body

    if (!student_id) {
      return Response.json({ error: 'student_id majburiy.' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // Use provided date or today in Uzbekistan time (UTC+5)
    const targetDate = date || new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10)

    // Find student's class_id
    const { data: student, error: studentError } = await serviceClient
      .from('students')
      .select('id, class_id')
      .eq('id', student_id)
      .eq('school_id', admin.school_id)
      .single()

    if (studentError || !student) {
      return Response.json({ error: 'O\'quvchi topilmadi.' }, { status: 404 })
    }

    // Upsert into attendance table
    const { error: upsertError } = await serviceClient
      .from('attendance')
      .upsert({
        student_id,
        class_id: student.class_id,
        date: targetDate,
        status: 'excused',
        method: 'manual',
        notes: reason || null,
        recorded_by: admin.id,
      }, { onConflict: 'student_id,date' })

    if (upsertError) throw upsertError

    // Clear stats cache so dashboard updates immediately
    clearStatsCache()

    return Response.json({ success: true, message: 'Status sababli ga o\'zgartirildi.' })
  } catch (error) {
    return handleApiError(error)
  }
}
