import { NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { encodeStudentQr } from '@/lib/student-qr'

/**
 * POST /api/qr/generate
 * Returns the student's permanent QR payload (same value every time).
 * Kept for mobile-app compatibility; permanent token is issued.
 */
export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'Sessiya muddati tugagan yoki tizimga kirilmagan.' }, { status: 401 })
    }

    const isAllowed = rateLimit(`qr_${user.id}`, 30, 60000)
    if (!isAllowed) {
      return Response.json({ error: 'Juda ko\'p urinishlar yuz berdi. Iltimos biroz kuting.' }, { status: 429 })
    }

    const serviceClient = createServiceClient()
    const { data: student } = await serviceClient
      .from('students')
      .select('id, school_id, status')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!student) {
      return Response.json({ error: 'O\'quvchi profili topilmadi.' }, { status: 404 })
    }

    if (student.status !== 'active') {
      return Response.json({ error: 'Ushbu o\'quvchi holati nofaol qilingan.' }, { status: 403 })
    }

    const token = encodeStudentQr(student.id)
    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + 10)

    return Response.json({
      token,
      ttl: 10 * 365 * 24 * 60 * 60,
      expires_at: expiresAt.toISOString(),
      permanent: true,
    })
  } catch (error) {
    console.error('QR Generate Error:', error)
    return Response.json({ error: 'Tizimda xatolik yuz berdi.' }, { status: 500 })
  }
}
