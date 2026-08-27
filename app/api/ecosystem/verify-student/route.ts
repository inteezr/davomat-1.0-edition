import { NextRequest } from 'next/server'
import { parseStudentQr } from '@/lib/student-qr'
import { rateLimit } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Universal Student QR Verification API for Ecosystem Integrations.
 * 
 * Allows external and internal sub-projects (classroom games, quizzes, library,
 * canteen, smart access terminals) to authenticate students via their permanent QR code.
 * 
 * POST /api/ecosystem/verify-student
 * Body: { qr_code: string, purpose?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'anon'
    const isAllowed = rateLimit(`ecosystem_verify_${ip}`, 180, 60000)
    if (!isAllowed) {
      return Response.json(
        { success: false, error: 'Juda ko\'p so\'rovlar yuborildi. Iltimos biroz kuting.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const rawQr = typeof body.qr_code === 'string' ? body.qr_code : (typeof body.token === 'string' ? body.token : '')
    const purpose = typeof body.purpose === 'string' ? body.purpose : 'general'

    if (!rawQr.trim()) {
      return Response.json(
        { success: false, error: 'QR kod ma\'lumoti yuborilmadi.' },
        { status: 400 }
      )
    }

    const parsed = parseStudentQr(rawQr)
    const serviceClient = createServiceClient()
    let query = serviceClient
      .from('students')
      .select('id, school_id, student_code, first_name, last_name, photo_url, phone, status, class_id, classes(name, grade)')
      .limit(1)

    if (parsed.kind === 'student_id') {
      query = query.eq('id', parsed.studentId)
    } else if (parsed.kind === 'student_code') {
      query = query.ilike('student_code', parsed.studentCode)
    } else {
      query = query.eq('id', parsed.token)
    }

    const { data } = await query.maybeSingle()

    if (!data) {
      return Response.json(
        { success: false, error: 'O\'quvchi topilmadi.' },
        { status: 404 }
      )
    }

    if (data.status !== 'active') {
      return Response.json(
        { success: false, error: 'Ushbu o\'quvchi holati nofaol qilingan.' },
        { status: 403 }
      )
    }

    const now = new Date().toISOString()

    return Response.json({
      success: true,
      purpose,
      student: {
        id: data.id,
        student_code: data.student_code,
        first_name: data.first_name,
        last_name: data.last_name,
        full_name: `${data.first_name} ${data.last_name}`.trim(),
        photo_url: data.photo_url,
        phone: data.phone,
        status: data.status,
        class_id: data.class_id,
        class_name: (data.classes as any)?.name || null,
        grade: (data.classes as any)?.grade || null,
        school_id: data.school_id,
      },
      verified_at: now,
    })
  } catch (error) {
    console.error('Ecosystem QR Verify Error:', error)
    return Response.json(
      { success: false, error: 'Tizimda xatolik yuz berdi.' },
      { status: 500 }
    )
  }
}
