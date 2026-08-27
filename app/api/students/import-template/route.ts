import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import * as XLSX from 'xlsx'

/**
 * GET /api/students/import-template
 * Generates and downloads a blank Excel template for student imports.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin session
    await verifyAdmin()

    // Define headers and a sample row
    const headers = ['Student ID', 'Ism', 'Familya', 'Sinf', 'Telefon']
    const sampleData = [
      {
        'Student ID': 'ST0001',
        'Ism': 'Ali',
        'Familya': 'Valiyev',
        'Sinf': '9-A',
        'Telefon': '+998901234567'
      }
    ]

    // Create a new workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(sampleData, { header: headers })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'O\'quvchilar')

    // Write to a buffer (xlsx format)
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })

    // Return the response as a downloadable file
    return new Response(excelBuffer, {
      status: 200,
      headers: {
        'Content-Disposition': 'attachment; filename="student_import_template.xlsx"',
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Length': excelBuffer.length.toString()
      }
    })
  } catch (error) {
    return handleApiError(error)
  }
}
