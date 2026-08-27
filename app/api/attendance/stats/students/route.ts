import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/attendance/stats/students?status=[present|late|excused|absent]
 * Returns the list of students with the specified status today.
 * When status=absent, returns both absent (unrecorded) and excused students so admins can see who was excused.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'present'

    // Get Uzbekistan local date (UTC+5)
    const nowUz = new Date(new Date().getTime() + 5 * 60 * 60 * 1000)
    const todayStr = nowUz.toISOString().split('T')[0]

    const serviceClient = createServiceClient()

    const [studentsRes, attendanceRes] = await Promise.all([
      serviceClient
        .from('students')
        .select('id, first_name, last_name, student_code, status, class_id, classes(name)')
        .eq('school_id', admin.school_id)
        .eq('status', 'active')
        .order('last_name', { ascending: true }),
      serviceClient
        .from('attendance')
        .select('student_id, status, checked_in_at, notes')
        .eq('date', todayStr)
    ])

    const activeStudents = studentsRes.data || []
    const todayAttendance = attendanceRes.data || []
    const attMap = new Map(todayAttendance.map(a => [a.student_id, a]))

    let studentsList: any[] = []

    if (status === 'absent') {
      // In absent list, include both unrecorded/absent students AND already excused students
      studentsList = activeStudents
        .filter(s => {
          const att = attMap.get(s.id)
          return !att || att.status === 'absent' || att.status === 'excused'
        })
        .map(s => {
          const att = attMap.get(s.id)
          return {
            id: s.id,
            first_name: s.first_name,
            last_name: s.last_name,
            student_code: s.student_code,
            class_name: (s.classes as any)?.name || null,
            status: att?.status || 'absent',
            notes: att?.notes || null,
            checked_in_at: att?.checked_in_at || null,
          }
        })
    } else {
      studentsList = activeStudents
        .filter(s => attMap.get(s.id)?.status === status)
        .map(s => {
          const att = attMap.get(s.id)
          return {
            id: s.id,
            first_name: s.first_name,
            last_name: s.last_name,
            student_code: s.student_code,
            class_name: (s.classes as any)?.name || null,
            status: att?.status || status,
            notes: att?.notes || null,
            checked_in_at: att?.checked_in_at || null,
          }
        })
    }

    return Response.json({
      success: true,
      status,
      date: todayStr,
      students: studentsList
    }, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate'
      }
    })

  } catch (error) {
    return handleApiError(error)
  }
}
