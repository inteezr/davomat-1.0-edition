import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import { createServiceClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

/**
 * GET /api/students/export
 * Exports all students of the school to an Excel spreadsheet.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin()
    const serviceClient = createServiceClient()

    const { data: rawStudents, error } = await serviceClient
      .from('students')
      .select('student_code, first_name, last_name, phone, temp_password, status, created_at, classes(name)')
      .eq('school_id', admin.school_id)
      .order('created_at', { ascending: false })

    if (error) throw error

    const students = (rawStudents || []).map((s: any) => ({
      'Student ID': s.student_code,
      'Ism': s.first_name,
      'Familya': s.last_name,
      'Sinf': s.classes?.name || '',
      'Telefon': s.phone || '',
      'Parol': s.temp_password || '',
      'Holati': s.status,
      'Yaratilgan sana': s.created_at
    }))

    // Generate Sheet
    const worksheet = XLSX.utils.json_to_sheet(students)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'O\'quvchilar')

    // Buffer output
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })
    const uint8 = new Uint8Array(excelBuffer)

    return new Response(uint8, {
      status: 200,
      headers: {
        'Content-Disposition': 'attachment; filename="student_export.xlsx"',
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Length': uint8.length.toString()
      }
    })
  } catch (error) {
    return handleApiError(error)
  }
}
