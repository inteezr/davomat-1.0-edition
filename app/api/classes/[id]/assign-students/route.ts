import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * POST /api/classes/[id]/assign-students
 * Assigns multiple students to a class in bulk.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdmin()
    const { id: classId } = await params
    const body = await request.json()

    const { student_ids } = body // Array of student UUIDs

    if (!Array.isArray(student_ids)) {
      return Response.json({ error: 'student_ids massiv ko\'rinishida bo\'lishi shart.' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // 1. Verify class belongs to this admin's school
    const { data: classRecord } = await serviceClient
      .from('classes')
      .select('name')
      .eq('id', classId)
      .eq('school_id', admin.school_id)
      .maybeSingle()

    if (!classRecord) {
      return Response.json({ error: 'Sinf topilmadi yoki sizda ruxsat yo\'q.' }, { status: 404 })
    }

    if (student_ids.length === 0) {
      return Response.json({ message: 'Hech qanday o\'quvchi tanlanmadi.' })
    }

    // 2. Perform bulk update, ensuring students belong to same school
    const { error: updateError } = await serviceClient
      .from('students')
      .update({ class_id: classId })
      .eq('school_id', admin.school_id)
      .in('id', student_ids)

    if (updateError) throw updateError

    return Response.json({ message: 'O\'quvchilar sinfga muvaffaqiyatli biriktirildi.' })
  } catch (error) {
    return handleApiError(error)
  }
}
