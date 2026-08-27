import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/attendance/history
 * Returns the history of attendance entries with filters and pagination.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin()
    
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || ''
    const startDate = searchParams.get('start_date') || ''
    const endDate = searchParams.get('end_date') || ''
    const classId = searchParams.get('class_id') || ''
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const offset = (page - 1) * limit

    const serviceClient = createServiceClient()
    let query = serviceClient
      .from('attendance')
      .select(`
        id,
        date,
        status,
        checked_in_at,
        method,
        students!inner(id, first_name, last_name, student_code, school_id),
        classes(name),
        admins(full_name)
      `, { count: 'exact' })
      .eq('students.school_id', admin.school_id)
      .order('date', { ascending: false })
      .order('checked_in_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (date) query = query.eq('date', date)
    if (startDate) query = query.gte('date', startDate)
    if (endDate) query = query.lte('date', endDate)
    if (classId) query = query.eq('class_id', classId)
    if (status) query = query.eq('status', status)
    if (search) {
      query = query.or(`students.first_name.ilike.%${search}%,students.last_name.ilike.%${search}%,students.student_code.ilike.%${search}%`)
    }

    const { data, count, error } = await query
    if (error) throw error

    const formatted = (data || []).map((row: any) => ({
      id: row.id,
      date: row.date,
      status: row.status,
      checked_in_at: row.checked_in_at,
      method: row.method,
      student_id: row.students?.id,
      first_name: row.students?.first_name,
      last_name: row.students?.last_name,
      student_code: row.students?.student_code,
      class_name: row.classes?.name || null,
      recorded_by_name: row.admins?.full_name || null,
    }))

    const total = count || 0
    return Response.json({
      data: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }, {
      headers: {
        'Cache-Control': 'private, max-age=5, stale-while-revalidate=15'
      }
    })

  } catch (error) {
    return handleApiError(error)
  }
}
