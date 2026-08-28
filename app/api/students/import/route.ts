import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import { createServiceClient } from '@/lib/supabase/server'
import { clearStatsCache } from '@/lib/stats-cache'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { promises as fs } from 'fs'
import path from 'path'

// Random 8-character alphanumeric password generator
function generateRandomPassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let password = ''
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

// Ensure the local uploads directory exists
async function ensureUploadsDirectory() {
  const dirPath = path.join(process.cwd(), 'public', 'uploads')
  try {
    await fs.access(dirPath)
  } catch {
    await fs.mkdir(dirPath, { recursive: true })
  }
  return dirPath
}

// Helper to extract field from row using flexible key matching
function extractField(row: any, keys: string[]): string {
  for (const k of Object.keys(row)) {
    const cleanK = k.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    for (const target of keys) {
      if (cleanK === target.toLowerCase().replace(/[^a-z0-9]/g, '')) {
        const val = row[k]
        if (val !== undefined && val !== null) {
          return String(val).trim()
        }
      }
    }
  }
  return ''
}

export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin()
    
    // Parse multipart form data
    const formData = await request.formData()
    const excelFile = formData.get('file') as File | null
    const zipFile = formData.get('zip') as File | null

    if (!excelFile) {
      return Response.json({ error: 'Excel fayl yuklanishi shart.' }, { status: 400 })
    }

    // 1. Read Excel file
    const excelBuffer = Buffer.from(await excelFile.arrayBuffer())
    const workbook = XLSX.read(excelBuffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<any>(worksheet)

    if (rows.length === 0) {
      return Response.json({ error: 'Excel faylda ma\'lumotlar topilmadi.' }, { status: 400 })
    }

    // 2. Read ZIP file if present
    const photoFiles: Record<string, Buffer> = {}
    if (zipFile && zipFile.size > 0) {
      const zipBuffer = await zipFile.arrayBuffer()
      const zip = await JSZip.loadAsync(zipBuffer)
      
      for (const [relativePath, file] of Object.entries(zip.files)) {
        if (!file.dir && (relativePath.toLowerCase().endsWith('.jpg') || relativePath.toLowerCase().endsWith('.jpeg') || relativePath.toLowerCase().endsWith('.png'))) {
          const buffer = await file.async('nodebuffer')
          const baseName = path.basename(relativePath, path.extname(relativePath)).trim().toUpperCase()
          photoFiles[baseName] = buffer
        }
      }
    }

    const createdCredentials: any[] = []
    const qrStudents: Array<{ id: string; student_code: string }> = []
    const failedRows: any[] = []
    const missingPhotos: string[] = []
    let successCount = 0

    const uploadsDir = await ensureUploadsDirectory()
    const serviceClient = createServiceClient()

    // 3. Pre-fetch all classes for this school
    const { data: existingClasses } = await serviceClient
      .from('classes')
      .select('id, name')
      .eq('school_id', admin.school_id)

    const classMap = new Map<string, string>()
    for (const c of (existingClasses || [])) {
      classMap.set(c.name.trim().toLowerCase(), c.id)
    }

    // Collect all class names from rows and auto-create any missing ones
    const missingClassNames = new Set<string>()
    for (const row of rows) {
      const clsName = extractField(row, ['sinf', 'class', 'sinfi', 'guruh', 'grade'])
      if (clsName && !classMap.has(clsName.toLowerCase())) {
        missingClassNames.add(clsName)
      }
    }

    if (missingClassNames.size > 0) {
      for (const newCls of missingClassNames) {
        const newClassUuid = crypto.randomUUID()
        const gradeMatch = newCls.match(/^(\d+)/)
        const grade = gradeMatch ? parseInt(gradeMatch[1], 10) : null
        
        await serviceClient.from('classes').insert({
          id: newClassUuid,
          school_id: admin.school_id,
          name: newCls,
          grade
        })
        classMap.set(newCls.toLowerCase(), newClassUuid)
      }
    }

    // 4. Pre-fetch all existing students for this school
    const { data: existingStudents } = await serviceClient
      .from('students')
      .select('id, student_code, auth_user_id, photo_url, temp_password')
      .eq('school_id', admin.school_id)

    const studentMap = new Map<string, any>()
    let maxSequentialNum = 0

    for (const s of (existingStudents || [])) {
      if (s.student_code) {
        studentMap.set(s.student_code.trim().toUpperCase(), s)
        const m = /^ST(\d+)$/i.exec(s.student_code.trim())
        if (m) {
          const n = parseInt(m[1], 10)
          if (n > maxSequentialNum) maxSequentialNum = n
        }
      }
    }

    // 5. Process rows sequentially to avoid auth race conditions
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex]

      let studentCode = extractField(row, ['studentid', 'studentcode', 'code', 'kod', 'id', 'oquvchiid'])
      const firstName = extractField(row, ['ism', 'firstname', 'name', 'oquvchiismi'])
      const lastName = extractField(row, ['familya', 'familiya', 'lastname', 'surname'])
      const className = extractField(row, ['sinf', 'class', 'sinfi', 'guruh', 'grade'])
      const phone = extractField(row, ['telefon', 'phone', 'tel'])
      const parentPhone = extractField(row, ['otaoanatelefoni', 'parentphone', 'otatelefoni', 'onatelefoni'])

      if (!firstName || !lastName) {
        failedRows.push({
          row: rowIndex + 2,
          student_code: studentCode || '—',
          reason: 'Ism yoki familiya kiritilmagan.'
        })
        continue
      }

      // Auto-generate code if empty
      if (!studentCode) {
        maxSequentialNum++
        studentCode = `ST${String(maxSequentialNum).padStart(3, '0')}`
      }

      const classId = className ? classMap.get(className.toLowerCase()) || null : null
      const normalizedCode = studentCode.toUpperCase()

      // Check photo in zip
      let photoUrl: string | null = null
      if (photoFiles[normalizedCode]) {
        try {
          const fileName = `${studentCode}.jpg`
          await fs.writeFile(path.join(uploadsDir, fileName), photoFiles[normalizedCode])
          photoUrl = `/uploads/${fileName}`
        } catch {
          missingPhotos.push(studentCode)
        }
      } else {
        missingPhotos.push(studentCode)
      }

      const existing = studentMap.get(normalizedCode)

      try {
        if (existing) {
          // Update existing student
          await serviceClient.from('students').update({
            first_name: firstName,
            last_name: lastName,
            class_id: classId || existing.class_id,
            phone: phone || existing.phone,
            parent_phone: parentPhone || existing.parent_phone,
            photo_url: photoUrl || existing.photo_url,
            updated_at: new Date().toISOString()
          }).eq('id', existing.id)

          qrStudents.push({ id: existing.id, student_code: studentCode })
        } else {
          // Create new student
          const password = generateRandomPassword()
          const email = `${studentCode.toLowerCase().trim()}_${Date.now()}@davomat.school`

          // Create Auth User first
          const { data: authData, error: authErr } = await serviceClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: `${firstName} ${lastName}` }
          })

          if (authErr || !authData?.user?.id) {
            throw new Error(`Auth foydalanuvchi yaratilmadi: ${authErr?.message || 'xato'}`)
          }

          const userId = authData.user.id

          const { error: insertError } = await serviceClient.from('students').insert({
            id: userId,
            school_id: admin.school_id,
            student_code: studentCode,
            first_name: firstName,
            last_name: lastName,
            class_id: classId,
            phone: phone || null,
            parent_phone: parentPhone || null,
            photo_url: photoUrl,
            status: 'active',
            temp_password: password,
            auth_user_id: userId
          })

          if (insertError) {
            // Clean up auth user
            await serviceClient.auth.admin.deleteUser(userId).catch(() => {})
            throw insertError
          }

          createdCredentials.push({
            student_code: studentCode,
            full_name: `${firstName} ${lastName}`,
            login: studentCode,
            password: password
          })

          qrStudents.push({ id: userId, student_code: studentCode })
          studentMap.set(normalizedCode, { id: userId, student_code: studentCode })
        }

        successCount++
      } catch (err: any) {
        failedRows.push({
          row: rowIndex + 2,
          student_code: studentCode,
          reason: err.message || 'Bazada saqlashda xatolik.'
        })
      }
    }

    clearStatsCache()

    return Response.json({
      message: 'Import yakunlandi.',
      total: rows.length,
      success: successCount,
      failed: failedRows.length,
      failed_rows: failedRows,
      missing_photos: missingPhotos,
      credentials: createdCredentials,
      qr_students: qrStudents
    })

  } catch (error) {
    return handleApiError(error)
  }
}
