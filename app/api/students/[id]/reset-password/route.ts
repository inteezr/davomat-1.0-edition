import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import { createServiceClient } from '@/lib/supabase/server'

// Random 8-character alphanumeric password generator
function generateRandomPassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let password = ''
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

/**
 * POST /api/students/[id]/reset-password
 * Generates a new random password for the student.
 */
export async function POST(
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
      .select('auth_user_id, student_code, first_name, last_name')
      .eq('id', id)
      .eq('school_id', admin.school_id)
      .maybeSingle()

    if (!student) {
      return Response.json({ error: 'O\'quvchi topilmadi yoki sizda ruxsat yo\'q.' }, { status: 404 })
    }

    const newPassword = generateRandomPassword()

    // 1. Update Auth user password via official Supabase Admin API
    if (student.auth_user_id) {
      await serviceClient.auth.admin.updateUserById(student.auth_user_id, {
        password: newPassword
      })
    }

    // 2. Update temp_password in public.students
    await serviceClient
      .from('students')
      .update({
        temp_password: newPassword,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    return Response.json({
      message: 'Parol muvaffaqiyatli tiklandi.',
      credentials: {
        login: student.student_code,
        password: newPassword
      }
    })
  } catch (error) {
    return handleApiError(error)
  }
}
