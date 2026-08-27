import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin()

    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('class_id')

    if (!classId) {
      return Response.json({ success: false, error: 'Sinf ID yuborilmadi.' }, { status: 400 })
    }

    // Today's date in Uzbekistan (UTC+5)
    const now = new Date()
    const uzOffset = 5 * 60 * 60 * 1000
    const uzDate = new Date(now.getTime() + uzOffset)
    const todayStr = uzDate.toISOString().split('T')[0]

    const serviceClient = createServiceClient()

    const [classRes, studentsRes] = await Promise.all([
      serviceClient
        .from('classes')
        .select('name')
        .eq('id', classId)
        .eq('school_id', admin.school_id)
        .maybeSingle(),
      serviceClient
        .from('students')
        .select('id, first_name, last_name, student_code, phone, parent_phone, photo_url')
        .eq('class_id', classId)
        .eq('school_id', admin.school_id)
        .eq('status', 'active')
        .order('last_name', { ascending: true })
    ])

    if (!classRes.data) {
      return Response.json({ success: false, error: 'Sinf topilmadi.' }, { status: 404 })
    }

    const studentsList = studentsRes.data || []
    const studentIds = studentsList.map(s => s.id)

    // Fetch attendance for these students today
    let todayAttendance: any[] = []
    if (studentIds.length > 0) {
      const { data: attData } = await serviceClient
        .from('attendance')
        .select('student_id, status, checked_in_at, method, notes')
        .in('student_id', studentIds)
        .eq('date', todayStr)
      todayAttendance = attData || []
    }

    const attMap = new Map(todayAttendance.map(a => [a.student_id, a]))

    const students = studentsList.map(s => {
      const att = attMap.get(s.id)
      return {
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        student_code: s.student_code,
        phone: s.phone,
        parent_phone: s.parent_phone,
        avatar_url: s.photo_url,
        attendance_status: att?.status || null,
        notes: att?.notes || null,
        checked_in_at: att?.checked_in_at || null,
        method: att?.method || null,
      }
    })

    return Response.json({
      success: true,
      className: classRes.data.name,
      date: todayStr,
      students
    }, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate'
      }
    })

  } catch (error) {
    return handleApiError(error)
  }
}
