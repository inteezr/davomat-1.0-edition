import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import { createServiceClient } from '@/lib/supabase/server'
import { clearStatsCache } from '@/lib/stats-cache'

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
 * GET /api/students
 * List students with filters, pagination, and class information.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin()
    
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const classId = searchParams.get('class_id') || ''
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const offset = (page - 1) * limit

    const serviceClient = createServiceClient()
    let query = serviceClient
      .from('students')
      .select('*, classes(name)', { count: 'exact' })
      .eq('school_id', admin.school_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (classId) query = query.eq('class_id', classId)
    if (status) query = query.eq('status', status)
    if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,student_code.ilike.%${search}%`)

    const { data, count, error } = await query
    if (error) throw error

    const formatted = (data || []).map((s: any) => ({
      ...s,
      class_name: s.classes?.name || null
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
        'Cache-Control': 'private, max-age=3, stale-while-revalidate=10'
      }
    })

  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/students
 * Creates a new student, automatically generates their Auth credentials.
 */
export async function POST(request: NextRequest) {
  const serviceClient = createServiceClient()
  let createdAuthUserId: string | null = null

  try {
    const admin = await verifyAdmin()
    const body = await request.json()
    
    const { 
      student_code, 
      first_name, 
      last_name, 
      class_id, 
      phone, 
      parent_phone, 
      status = 'active'
    } = body

    if (!student_code || !first_name || !last_name) {
      return Response.json({ error: 'Student ID, ism va familiya majburiy.' }, { status: 400 })
    }

    // 1. Check if student_code already exists
    const { data: existing } = await serviceClient
      .from('students')
      .select('id')
      .eq('student_code', student_code.trim())
      .maybeSingle()

    if (existing) {
      return Response.json({ error: 'Ushbu Student ID allaqachon mavjud.' }, { status: 400 })
    }

    // 2. Generate random password and internal email
    const password = generateRandomPassword()
    const email = `${student_code.toLowerCase().trim()}@davomat.school`

    // 3. Check if email already taken in auth
    const { data: existingAuth } = await serviceClient.auth.admin.listUsers()
    const emailTaken = existingAuth?.users?.find(u => u.email === email)
    
    const finalEmail = emailTaken
      ? `${student_code.toLowerCase().trim()}_${Date.now()}@davomat.school`
      : email

    // 4. Create Auth user — MUST succeed before DB insert (FK constraint)
    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email: finalEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: `${first_name.trim()} ${last_name.trim()}` }
    })

    if (authError || !authData?.user?.id) {
      console.error('Auth user create error:', authError)
      return Response.json(
        { error: `Foydalanuvchi yaratishda xatolik: ${authError?.message || 'Noma\'lum xato'}` },
        { status: 500 }
      )
    }

    createdAuthUserId = authData.user.id

    // 5. Create student profile in public.students
    const { data: student, error: studentError } = await serviceClient
      .from('students')
      .insert({
        id: createdAuthUserId,
        school_id: admin.school_id,
        student_code: student_code.trim(),
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        class_id: class_id || null,
        phone: phone || null,
        parent_phone: parent_phone || null,
        status: status || 'active',
        temp_password: password,
        auth_user_id: createdAuthUserId,
      })
      .select()
      .single()

    if (studentError) {
      // Rollback: delete the created auth user to avoid orphan accounts
      console.error('Student DB insert error:', studentError)
      await serviceClient.auth.admin.deleteUser(createdAuthUserId).catch(() => {})
      createdAuthUserId = null
      throw studentError
    }

    // Clear server stats cache so dashboard updates total counts immediately
    clearStatsCache()

    return Response.json({
      message: 'O\'quvchi muvaffaqiyatli yaratildi.',
      student,
      credentials: {
        login: student_code,
        password: password
      }
    }, { status: 201 })

  } catch (error) {
    // Safety rollback if anything went wrong after auth user was created
    if (createdAuthUserId) {
      await serviceClient.auth.admin.deleteUser(createdAuthUserId).catch(() => {})
    }
    return handleApiError(error)
  }
}
