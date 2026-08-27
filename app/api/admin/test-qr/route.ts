import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import { createServiceClient } from '@/lib/supabase/server'
import { encodeStudentQr } from '@/lib/student-qr'

/**
 * POST /api/admin/test-qr
 * Returns the permanent QR payload for a student. Admin-only — for scanner testing.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin()
    const body = await request.json().catch(() => ({}))
    const studentId = body.student_id
    const serviceClient = createServiceClient()

    let query = serviceClient
      .from('students')
      .select('id, student_code, first_name, last_name')
      .eq('school_id', admin.school_id)
      .limit(1)

    if (studentId) {
      query = query.eq('id', studentId)
    }

    const { data: student } = await query.maybeSingle()

    if (!student) {
      return Response.json({ error: 'O\'quvchi topilmadi' }, { status: 404 })
    }

    const token = encodeStudentQr(student.id)

    return Response.json({
      token,
      student_code: student.student_code,
      name: `${student.first_name} ${student.last_name}`,
      expires_at: null,
      ttl_seconds: 0,
      permanent: true,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
