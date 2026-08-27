import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import { createServiceClient } from '@/lib/supabase/server'
import { studentQrPngBuffer, encodeStudentQr } from '@/lib/student-qr'

/**
 * GET /api/students/[id]/qr
 * Returns the student's permanent QR code as a PNG image.
 * Admin auth required.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdmin()
    const { id } = await params
    const serviceClient = createServiceClient()

    // Verify student belongs to admin's school
    const { data: student } = await serviceClient
      .from('students')
      .select('id, student_code')
      .eq('id', id)
      .eq('school_id', admin.school_id)
      .maybeSingle()

    if (!student) {
      return Response.json({ error: 'O\'quvchi topilmadi.' }, { status: 404 })
    }

    const buffer = await studentQrPngBuffer(student.id)
    const uint8 = new Uint8Array(buffer)

    return new Response(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="${student.student_code}-qr.png"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * GET /api/students/[id]/qr?format=text
 * Returns the raw QR code text (DAV1|<uuid>) as plain text.
 */
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdmin()
    const { id } = await params
    const serviceClient = createServiceClient()

    const { data: student } = await serviceClient
      .from('students')
      .select('id')
      .eq('id', id)
      .eq('school_id', admin.school_id)
      .maybeSingle()

    if (!student) {
      return new Response(null, { status: 404 })
    }

    return new Response(null, {
      status: 200,
      headers: {
        'X-QR-Content': encodeStudentQr(id),
        'X-QR-Format': 'DAV1',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
