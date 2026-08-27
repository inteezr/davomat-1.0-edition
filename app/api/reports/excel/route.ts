import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import { createServiceClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

/**
 * GET /api/reports/excel
 * Generates an attendance matrix spreadsheet for a date range and class.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin()
    
    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('class_id') || ''
    const startDate = searchParams.get('start_date') || ''
    const endDate = searchParams.get('end_date') || ''

    if (!classId || !startDate || !endDate) {
      return Response.json({ error: 'Sinf, boshlanish va tugash sanalari kiritilishi shart.' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // 1. Fetch class and active students
    const [classRes, studentsRes] = await Promise.all([
      serviceClient
        .from('classes')
        .select('name')
        .eq('id', classId)
        .eq('school_id', admin.school_id)
        .maybeSingle(),
      serviceClient
        .from('students')
        .select('id, first_name, last_name, student_code')
        .eq('class_id', classId)
        .eq('school_id', admin.school_id)
        .eq('status', 'active')
        .order('last_name', { ascending: true })
    ])

    if (!classRes.data) {
      return Response.json({ error: 'Sinf topilmadi.' }, { status: 404 })
    }

    const className = classRes.data.name
    const students = studentsRes.data || []

    if (students.length === 0) {
      return Response.json({ error: 'Ushbu sinfda o\'quvchilar mavjud emas.' }, { status: 400 })
    }

    const studentIds = students.map(s => s.id)

    // 2. Fetch attendance for these students in date range
    const { data: attendanceData } = await serviceClient
      .from('attendance')
      .select('student_id, date, status')
      .in('student_id', studentIds)
      .gte('date', startDate)
      .lte('date', endDate)

    // Map entries: studentId_dateString -> status
    const attendanceMap: Record<string, string> = {}
    ;(attendanceData || []).forEach((entry) => {
      const dateStr = String(entry.date).slice(0, 10)
      attendanceMap[`${entry.student_id}_${dateStr}`] = entry.status
    })

    // Generate Date headers in range (chronological) using UTC
    const start = new Date(`${startDate}T00:00:00Z`)
    const end = new Date(`${endDate}T00:00:00Z`)
    const datesList: string[] = []
    
    for (let d = new Date(start); d.getTime() <= end.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
      datesList.push(d.toISOString().split('T')[0])
    }

    // Construct rows for Excel
    const rows = students.map((student) => {
      const rowData: Record<string, string> = {
        'Student ID': student.student_code,
        'F.I.SH.': `${student.last_name} ${student.first_name}`
      }

      // Add status for each date
      datesList.forEach((dateStr) => {
        const status = attendanceMap[`${student.id}_${dateStr}`]
        let label = 'YK' // Default: Absent (Yo'q / Kelmagan)
        if (status === 'present') label = 'K' // Present (Keldi)
        if (status === 'late') label = 'K-CH' // Late (Kechikdi)
        if (status === 'excused') label = 'S' // Excused (Sababli)
        
        rowData[dateStr] = label
      })

      return rowData
    })

    // Build Spreadsheet
    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, `Davomat - ${className}`)

    // Set column widths
    const colWidths = [
      { wch: 12 }, // Student ID
      { wch: 28 }, // Name
      ...datesList.map(() => ({ wch: 10 })) // Date headers
    ]
    worksheet['!cols'] = colWidths

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })
    const uint8 = new Uint8Array(excelBuffer)

    return new Response(uint8, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="davomat_${className}_${startDate}_${endDate}.xlsx"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Length': uint8.length.toString()
      }
    })

  } catch (error) {
    return handleApiError(error)
  }
}
