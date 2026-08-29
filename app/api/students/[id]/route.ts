import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import { createServiceClient } from '@/lib/supabase/server'
import { clearStatsCache } from '@/lib/stats-cache'

/**
 * PUT /api/students/[id]
 * Updates student information and clears global stats cache.
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

    const { data: updatedStudent, error: updateError } = await serviceClient
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
      .select()
      .single()

    if (updateError) throw updateError

    // Clear server stats cache so dashboard and classes reflect changes immediately
    clearStatsCache()

    return Response.json({ 
      message: 'O\'quvchi ma\'lumotlari yangilandi.',
      student: updatedStudent
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/students/[id]
 * Cascade deletes a student, their attendance history, and Auth account,
 * then purges all stats caches.
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

    // 1. Cascade delete all attendance records for this student
    await serviceClient
      .from('attendance')
      .delete()
      .eq('student_id', id)

    // 2. Delete student record from public.students
    const { error: deleteError } = await serviceClient
      .from('students')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    // 3. Delete Auth user if exists
    if (student.auth_user_id) {
      await serviceClient.auth.admin.deleteUser(student.auth_user_id).catch(() => {})
    }

    // 4. Purge server-side stats cache immediately
    clearStatsCache()

    return Response.json({ message: 'O\'quvchi va unga tegishli barcha ma\'lumotlar muvaffaqiyatli o\'chirildi.' })
  } catch (error) {
    return handleApiError(error)
  }
}
