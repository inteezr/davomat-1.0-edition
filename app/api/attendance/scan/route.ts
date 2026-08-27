import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import { rateLimit } from '@/lib/rate-limit'
import { parseStudentQr, settingToString } from '@/lib/student-qr'
import { createServiceClient } from '@/lib/supabase/server'
import { clearStatsCache } from '@/lib/stats-cache'

type ScanStudent = {
  id: string
  first_name: string
  last_name: string
  student_code: string
  status: string
  photo_url: string | null
  class_id: string | null
  class_name: string | null
}

function isUniqueViolation(error: unknown) {
  if (error && typeof error === 'object') {
    if ('code' in error && (error as { code: string }).code === '23505') return true
    if ('message' in error && String((error as { message: string }).message).includes('duplicate key')) return true
  }
  return false
}

interface CachedSettings {
  lateThreshold: number
  classStartTime: string
  startMinutes: number
  expiresAt: number
}

let cachedSettings: CachedSettings | null = null

async function getCachedSettings(): Promise<{ lateThreshold: number; startMinutes: number }> {
  const now = Date.now()
  if (cachedSettings && now < cachedSettings.expiresAt) {
    return {
      lateThreshold: cachedSettings.lateThreshold,
      startMinutes: cachedSettings.startMinutes,
    }
  }

  try {
    const serviceClient = createServiceClient()
    const { data: settings } = await serviceClient
      .from('settings')
      .select('key, value')
      .in('key', ['late_threshold_minutes', 'class_start_time'])

    const lateThreshold = parseInt(
      settingToString((settings || []).find((s) => s.key === 'late_threshold_minutes')?.value, '15'),
      10,
    )
    const classStartTime = settingToString(
      (settings || []).find((s) => s.key === 'class_start_time')?.value,
      '08:30',
    )
    const [startHour, startMin] = classStartTime.split(':').map(Number)
    const startMinutes = (startHour || 0) * 60 + (startMin || 0)

    cachedSettings = {
      lateThreshold: Number.isFinite(lateThreshold) ? lateThreshold : 15,
      classStartTime,
      startMinutes,
      expiresAt: now + 60000, // 1 minute TTL
    }

    return {
      lateThreshold: cachedSettings.lateThreshold,
      startMinutes: cachedSettings.startMinutes,
    }
  } catch {
    return {
      lateThreshold: 15,
      startMinutes: 8 * 60 + 30,
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin()

    const isAllowed = rateLimit(`scan_${admin.id}`, 120, 60000)
    if (!isAllowed) {
      return Response.json({
        success: false,
        code: 'NETWORK_ERROR',
        message: 'Juda ko\'p urinishlar yuz berdi. Iltimos biroz kuting.',
      }, { status: 429 })
    }

    const body = await request.json()
    const rawToken = typeof body.token === 'string' ? body.token : ''

    if (!rawToken.trim()) {
      return Response.json({
        success: false,
        code: 'TOKEN_NOT_FOUND',
        message: 'QR kod o\'qilmadi.',
      }, { status: 400 })
    }

    const parsed = parseStudentQr(rawToken)
    const serviceClient = createServiceClient()

    let query = serviceClient
      .from('students')
      .select('id, first_name, last_name, student_code, status, photo_url, class_id, classes(name)')
      .eq('school_id', admin.school_id)
      .limit(1)

    if (parsed.kind === 'student_id') {
      query = query.eq('id', parsed.studentId)
    } else if (parsed.kind === 'student_code') {
      query = query.ilike('student_code', parsed.studentCode)
    } else {
      query = query.eq('id', parsed.token)
    }

    const { data: studentRow } = await query.maybeSingle()
    
    let student: ScanStudent | null = null
    if (studentRow) {
      student = {
        id: studentRow.id,
        first_name: studentRow.first_name,
        last_name: studentRow.last_name,
        student_code: studentRow.student_code,
        status: studentRow.status,
        photo_url: studentRow.photo_url,
        class_id: studentRow.class_id,
        class_name: (studentRow.classes as any)?.name || null,
      }
    }

    if (!student) {
      return Response.json({
        success: false,
        code: 'TOKEN_NOT_FOUND',
        message: 'O\'quvchi topilmadi yoki boshqa maktabga tegishli.',
      })
    }

    if (student.status !== 'active') {
      return Response.json({
        success: false,
        code: 'STUDENT_INACTIVE',
        message: 'Ushbu o\'quvchi holati nofaol qilingan.',
      })
    }

    const now = new Date()
    const nowUz = new Date(now.getTime() + 5 * 60 * 60 * 1000)
    const uzDateString = nowUz.toISOString().split('T')[0]

    const { lateThreshold, startMinutes } = await getCachedSettings()
    const currentMinutes = nowUz.getUTCHours() * 60 + nowUz.getUTCMinutes()

    let status: 'present' | 'late' = 'present'
    if (currentMinutes > startMinutes + lateThreshold) {
      status = 'late'
    }

    try {
      const { error: insertError } = await serviceClient
        .from('attendance')
        .insert({
          student_id: student.id,
          class_id: student.class_id,
          date: uzDateString,
          status,
          checked_in_at: now.toISOString(),
          method: 'qr',
          recorded_by: admin.id
        })

      if (insertError) {
        if (insertError.code === '23505' || insertError.message?.includes('duplicate key')) {
          return Response.json({
            success: false,
            code: 'ALREADY_MARKED_TODAY',
            message: 'Bugun uchun davomat allaqachon yozilgan.',
          })
        }
        throw insertError
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        return Response.json({
          success: false,
          code: 'ALREADY_MARKED_TODAY',
          message: 'Bugun uchun davomat allaqachon yozilgan.',
        })
      }
      throw error
    }

    // Clear stats cache so dashboard updates instantly
    clearStatsCache()

    return Response.json({
      success: true,
      code: 'SUCCESS',
      student: {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        photo_url: student.photo_url,
        student_code: student.student_code,
      },
      class_name: student.class_name || undefined,
      checked_in_at: now.toISOString(),
      status,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
