import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/students/next-code
 * Returns the next sequential student code like ST001, ST002, ...
 * Finds the current max numeric value from all student_codes matching "ST\d+" pattern.
 */
export async function GET() {
  try {
    const admin = await verifyAdmin()
    const serviceClient = createServiceClient()

    // Fetch all student_codes for this school
    const { data, error } = await serviceClient
      .from('students')
      .select('student_code')
      .eq('school_id', admin.school_id)

    if (error) throw error

    // Parse codes matching ST followed by digits, find the max
    let maxNum = 0
    for (const row of data || []) {
      const match = /^ST(\d+)$/i.exec(row.student_code || '')
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNum) maxNum = num
      }
    }

    // Next number, formatted with leading zeros (minimum 3 digits)
    const nextNum = maxNum + 1
    const padded = String(nextNum).padStart(3, '0')
    const nextCode = `ST${padded}`

    return Response.json({ next_code: nextCode })
  } catch (error) {
    return handleApiError(error)
  }
}
