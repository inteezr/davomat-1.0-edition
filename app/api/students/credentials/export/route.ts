import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import * as XLSX from 'xlsx'

/**
 * POST /api/students/credentials/export
 * Receives the generated student credentials and returns a formatted Excel download.
 */
export async function POST(request: NextRequest) {
  try {
    await verifyAdmin()
    const body = await request.json()

    const { credentials } = body // Array of { student_code, full_name, login, password }

    if (!Array.isArray(credentials) || credentials.length === 0) {
      return Response.json({ error: 'Eksport qilinadigan ma\'lumotlar topilmadi.' }, { status: 400 })
    }

    // Format headers and data
    const exportData = credentials.map((cred) => ({
      'Student ID': cred.student_code,
      'F.I.SH.': cred.full_name,
      'Login': cred.login,
      'Parol': cred.password
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Kirish Ma\'lumotlari')

    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 }, // Student ID
      { wch: 30 }, // F.I.SH.
      { wch: 20 }, // Login
      { wch: 15 }  // Password
    ]

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })
    const uint8 = new Uint8Array(excelBuffer)

    return new Response(uint8, {
      status: 200,
      headers: {
        'Content-Disposition': 'attachment; filename="student_credentials.xlsx"',
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Length': uint8.length.toString()
      }
    })
  } catch (error) {
    return handleApiError(error)
  }
}
