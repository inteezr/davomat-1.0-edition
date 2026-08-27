import QRCode from 'qrcode'
import JSZip from 'jszip'

export const STUDENT_QR_PREFIX = 'DAV1'

export function encodeStudentQr(studentId: string) {
  return `${STUDENT_QR_PREFIX}|${studentId}`
}

export function qrFileName(studentCode: string) {
  const safe = studentCode.trim().replace(/[^a-zA-Z0-9._-]/g, '_') || 'student'
  return `${safe}.png`
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ParsedStudentQr =
  | { kind: 'student_id'; studentId: string }
  | { kind: 'student_code'; studentCode: string }
  | { kind: 'legacy_token'; token: string }

export function parseStudentQr(raw: string): ParsedStudentQr {
  const text = raw.replace(/^\uFEFF/, '').trim()

  const prefixed = text.match(/^DAV1[:|]([0-9a-f-]{36})$/i)
  if (prefixed) {
    return { kind: 'student_id', studentId: prefixed[1] }
  }

  try {
    const obj = JSON.parse(text) as { v?: number; id?: string; student_id?: string }
    const id = obj.id || obj.student_id
    if (id && UUID_RE.test(id)) {
      return { kind: 'student_id', studentId: id }
    }
  } catch {
    // not JSON
  }

  if (UUID_RE.test(text)) {
    return { kind: 'legacy_token', token: text }
  }

  return { kind: 'student_code', studentCode: text }
}

export async function studentQrPngBuffer(studentId: string) {
  return QRCode.toBuffer(encodeStudentQr(studentId), {
    type: 'png',
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'H',
  })
}

export async function buildStudentQrZip(
  students: Array<{ id: string; student_code: string }>,
) {
  const zip = new JSZip()
  const usedNames = new Set<string>()

  // Process in chunks of 25 concurrent promises to maximize throughput without memory spikes
  const CHUNK_SIZE = 25
  for (let i = 0; i < students.length; i += CHUNK_SIZE) {
    const chunk = students.slice(i, i + CHUNK_SIZE)
    const results = await Promise.all(
      chunk.map(async (student) => {
        const buffer = await studentQrPngBuffer(student.id)
        return { student, buffer }
      }),
    )

    for (const { student, buffer } of results) {
      let fileName = qrFileName(student.student_code)
      if (usedNames.has(fileName)) {
        fileName = qrFileName(`${student.student_code}_${student.id.slice(0, 8)}`)
      }
      usedNames.add(fileName)
      zip.file(fileName, buffer)
    }
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}


export function settingToString(value: unknown, fallback: string) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length ? trimmed : fallback
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return fallback
}
