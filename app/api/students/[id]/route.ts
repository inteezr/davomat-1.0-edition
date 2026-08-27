import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * PUT /api/students/[id]
 * Updates student information.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdmin()
    const { id } = await params
    const body = await request.json()

    const {
      first_name,
      last_name,
      class_id,
      phone,
      parent_phone,
      status
    } = body

    if (!first_name || !last_name) {
      return Response.json({ error: 'Ism va familiya majburiy.' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // Check if student belongs to this admin's school
    const { data: student } = await serviceClient
      .from('students')
      .select('auth_user_id, student_code')
      .eq('id', id)
      .eq('school_id', admin.school_id)
      .maybeSingle()

    if (!student) {
      return Response.json({ error: 'O\'quvchi topilmadi yoki sizda ruxsat yo\'q.' }, { status: 404 })
    }

    const { error: updateError } = await serviceClient
      .from('students')
      .update({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        class_id: class_id || null,
        phone: phone || null,
        parent_phone: parent_phone || null,
        status: status || 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) throw updateError

    return Response.json({ message: 'O\'quvchi ma\'lumotlari yangilandi.' })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/students/[id]
 * Deletes a student and their associated Auth credentials.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdmin()
    const { id } = await params
    const serviceClient = createServiceClient()

    // Check if student belongs to this admin's school
    const { data: student } = await serviceClient
      .from('students')
      .select('auth_user_id, student_code')
      .eq('id', id)
      .eq('school_id', admin.school_id)
      .maybeSingle()

    if (!student) {
      return Response.json({ error: 'O\'quvchi topilmadi yoki sizda ruxsat yo\'q.' }, { status: 404 })
    }

    // Delete student record
    const { error: deleteError } = await serviceClient
      .from('students')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    // Delete Auth user if exists
    if (student.auth_user_id) {
      await serviceClient.auth.admin.deleteUser(student.auth_user_id).catch(() => {})
    }

    return Response.json({ message: 'O\'quvchi muvaffaqiyatli o\'chirildi.' })
  } catch (error) {
    return handleApiError(error)
  }
}
