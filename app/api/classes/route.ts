import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/classes
 * Lists all classes for the admin's school with student counts.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin()
    const serviceClient = createServiceClient()

    const [classesRes, studentsRes] = await Promise.all([
      serviceClient
        .from('classes')
        .select('*')
        .eq('school_id', admin.school_id)
        .order('name', { ascending: true }),
      serviceClient
        .from('students')
        .select('id, class_id')
        .eq('school_id', admin.school_id)
        .eq('status', 'active')
    ])

    const classes = classesRes.data || []
    const students = studentsRes.data || []
    const countMap = new Map<string, number>()
    students.forEach(s => {
      if (s.class_id) {
        countMap.set(s.class_id, (countMap.get(s.class_id) || 0) + 1)
      }
    })

    const data = classes.map(c => ({
      ...c,
      student_count: countMap.get(c.id) || 0
    }))

    return Response.json({ data }, {
      headers: {
        'Cache-Control': 'private, max-age=5, stale-while-revalidate=15'
      }
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/classes
 * Creates a new class.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin()
    const body = await request.json()
    
    const { name, grade } = body

    if (!name) {
      return Response.json({ error: 'Sinf nomi majburiy.' }, { status: 400 })
    }

    const trimmedName = name.trim()
    const serviceClient = createServiceClient()

    const { data: existing } = await serviceClient
      .from('classes')
      .select('id')
      .eq('school_id', admin.school_id)
      .eq('name', trimmedName)
      .maybeSingle()

    if (existing) {
      return Response.json({ error: 'Ushbu sinf allaqachon mavjud.' }, { status: 400 })
    }

    const classUuid = crypto.randomUUID()
    const { data, error } = await serviceClient
      .from('classes')
      .insert({
        id: classUuid,
        school_id: admin.school_id,
        name: trimmedName,
        grade: grade || null,
      })
      .select()
      .single()

    if (error) throw error

    return Response.json({
      message: 'Sinf muvaffaqiyatli yaratildi.',
      class: data || { id: classUuid, name: trimmedName, grade }
    }, { status: 201 })

  } catch (error) {
    return handleApiError(error)
  }
}
