import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import { createServiceClient } from '@/lib/supabase/server'
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

    // Pre-fetch all classes for this school into memory
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
      const clsName = (row['Sinf'] || row['class'] || '').toString().trim()
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

    // Pre-fetch all existing students for this school into memory
    const { data: existingStudents } = await serviceClient
      .from('students')
      .select('id, student_code, auth_user_id, photo_url, temp_password')
      .eq('school_id', admin.school_id)

    const studentMap = new Map<string, any>()
    for (const s of (existingStudents || [])) {
      studentMap.set(s.student_code.trim().toUpperCase(), s)
    }

    // Process rows in parallel chunks of 15
    const CHUNK_SIZE = 15
    for (let chunkIdx = 0; chunkIdx < rows.length; chunkIdx += CHUNK_SIZE) {
      const chunk = rows.slice(chunkIdx, chunkIdx + CHUNK_SIZE)

      await Promise.all(
        chunk.map(async (row: any, localIdx: number) => {
          const rowIndex = chunkIdx + localIdx
          const studentCode = (row['Student ID'] || row['student_id'] || '').toString().trim()
          const firstName = (row['Ism'] || row['first_name'] || '').toString().trim()
          const lastName = (row['Familya'] || row['last_name'] || '').toString().trim()
          const className = (row['Sinf'] || row['class'] || '').toString().trim()
          const phone = (row['Telefon'] || row['phone'] || '').toString().trim()

          if (!studentCode || !firstName || !lastName) {
            failedRows.push({
              row: rowIndex + 2,
              student_code: studentCode || '—',
              reason: 'Student ID, ism yoki familiya bo\'sh.'
            })
            return
          }

          const classId = className ? classMap.get(className.toLowerCase()) || null : null

          // Check if photo is present in zip
          let photoUrl: string | null = null
          const normalizedCode = studentCode.toUpperCase()
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
              const studentId = existing.id
              const authUserId = existing.auth_user_id
              let currentTempPassword = existing.temp_password

              if (!currentTempPassword && authUserId) {
                const newPassword = generateRandomPassword()
                await serviceClient.auth.admin.updateUserById(authUserId, { password: newPassword }).catch(() => {})

                await serviceClient.from('students').update({
                  first_name: firstName,
                  last_name: lastName,
                  class_id: classId,
                  phone: phone || null,
                  photo_url: photoUrl || existing.photo_url || null,
                  temp_password: newPassword,
                  updated_at: new Date().toISOString()
                }).eq('id', studentId)

                createdCredentials.push({
                  student_code: studentCode,
                  full_name: `${firstName} ${lastName}`,
                  login: studentCode,
                  password: newPassword
                })
              } else {
                await serviceClient.from('students').update({
                  first_name: firstName,
                  last_name: lastName,
                  class_id: classId,
                  phone: phone || null,
                  photo_url: photoUrl || existing.photo_url || null,
                  updated_at: new Date().toISOString()
                }).eq('id', studentId)
              }

              qrStudents.push({ id: studentId, student_code: studentCode })
            } else {
              const password = generateRandomPassword()
              const email = `${studentCode.toLowerCase()}@students.internal`

              const { data: authData } = await serviceClient.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { full_name: `${firstName} ${lastName}` }
              })

              const userUuid = authData?.user?.id || crypto.randomUUID()

              await serviceClient.from('students').insert({
                id: userUuid,
                school_id: admin.school_id,
                student_code: studentCode,
                first_name: firstName,
                last_name: lastName,
                class_id: classId,
                phone: phone || null,
                photo_url: photoUrl,
                status: 'active',
                temp_password: password,
                auth_user_id: userUuid
              })

              createdCredentials.push({
                student_code: studentCode,
                full_name: `${firstName} ${lastName}`,
                login: studentCode,
                password: password
              })

              qrStudents.push({ id: userUuid, student_code: studentCode })
            }

            successCount++
          } catch (err: any) {
            failedRows.push({
              row: rowIndex + 2,
              student_code: studentCode,
              reason: err.message || 'Bazada saqlashda xatolik.'
            })
          }
        })
      )
    }

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
