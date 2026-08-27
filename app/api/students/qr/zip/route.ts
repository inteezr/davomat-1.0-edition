import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import { createServiceClient } from '@/lib/supabase/server'
import { buildStudentQrZip } from '@/lib/student-qr'

export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin()
    const body = await request.json().catch(() => ({}))

    const all = Boolean(body.all)
    const incoming = Array.isArray(body.students) ? body.students : []

    const serviceClient = createServiceClient()
    let students: Array<{ id: string; student_code: string }> = []

    if (all) {
      const { data } = await serviceClient
        .from('students')
        .select('id, student_code')
        .eq('school_id', admin.school_id)
        .order('student_code', { ascending: true })

      students = data || []
    } else if (incoming.length > 0) {
      const ids = incoming
        .map((row: { id?: string }) => row.id)
        .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)

      if (ids.length === 0) {
        return Response.json({ error: 'QR uchun o\'quvchilar yuborilmadi.' }, { status: 400 })
      }

      const { data } = await serviceClient
        .from('students')
        .select('id, student_code')
        .eq('school_id', admin.school_id)
        .in('id', ids)
        .order('student_code', { ascending: true })

      students = data || []
    } else {
      return Response.json({ error: 'QR uchun o\'quvchilar yuborilmadi.' }, { status: 400 })
    }

    if (students.length === 0) {
      return Response.json({ error: 'QR kod yaratish uchun o\'quvchi topilmadi.' }, { status: 404 })
    }

    const zipBuffer = await buildStudentQrZip(students)

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="student_qr_codes.zip"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
