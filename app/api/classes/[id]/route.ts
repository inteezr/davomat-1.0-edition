import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * PUT /api/classes/[id]
 * Updates class information.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdmin()
    const { id } = await params
    const body = await request.json()

    const { name, grade } = body

    if (!name) {
      return Response.json({ error: 'Sinf nomi majburiy.' }, { status: 400 })
    }

    const trimmedName = name.trim()
    const serviceClient = createServiceClient()

    // Check if class belongs to this admin's school
    const { data: classRecord } = await serviceClient
      .from('classes')
      .select('name')
      .eq('id', id)
      .eq('school_id', admin.school_id)
      .maybeSingle()

    if (!classRecord) {
      return Response.json({ error: 'Sinf topilmadi yoki sizda ruxsat yo\'q.' }, { status: 404 })
    }

    // Check if name is taken by another class in same school
    const { data: duplicate } = await serviceClient
      .from('classes')
      .select('id')
      .eq('school_id', admin.school_id)
      .eq('name', trimmedName)
      .neq('id', id)
      .maybeSingle()

    if (duplicate) {
      return Response.json({ error: 'Ushbu nomdagi sinf allaqachon mavjud.' }, { status: 400 })
    }

    const { error: updateError } = await serviceClient
      .from('classes')
      .update({
        name: trimmedName,
        grade: grade || null,
      })
      .eq('id', id)

    if (updateError) throw updateError

    return Response.json({ message: 'Sinf ma\'lumotlari yangilandi.' })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/classes/[id]
 * Deletes a class. Students inside this class will have class_id set to NULL automatically by DB schema or cascade.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdmin()
    const { id } = await params
    const serviceClient = createServiceClient()

    // Check if class belongs to this admin's school
    const { data: classRecord } = await serviceClient
      .from('classes')
      .select('name')
      .eq('id', id)
      .eq('school_id', admin.school_id)
      .maybeSingle()

    if (!classRecord) {
      return Response.json({ error: 'Sinf topilmadi yoki sizda ruxsat yo\'q.' }, { status: 404 })
    }

    // Set class_id to null for students in this class
    await serviceClient
      .from('students')
      .update({ class_id: null })
      .eq('class_id', id)

    const { error: deleteError } = await serviceClient
      .from('classes')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    return Response.json({ message: 'Sinf muvaffaqiyatli o\'chirildi.' })
  } catch (error) {
    return handleApiError(error)
  }
}
