// ============================================================
// Davomat 1.0 — Database Types (generated from schema)
// ============================================================

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'
export type AttendanceMethod = 'qr' | 'manual'
export type StudentStatus = 'active' | 'inactive'

// ---- schools ----
export interface School {
  id: string
  name: string
  logo_url: string | null
  created_at: string
}

// ---- admins ----
export interface Admin {
  id: string
  school_id: string | null
  full_name: string
  phone: string | null
  created_at: string
}

// ---- classes ----
export interface Class {
  id: string
  school_id: string
  name: string       // "9-A"
  grade: number | null
  created_at: string
}

// ---- students ----
export interface Student {
  id: string
  school_id: string
  student_code: string   // "ST0001" — login ham
  first_name: string
  last_name: string
  class_id: string | null
  phone: string | null
  parent_phone: string | null
  photo_url: string | null
  status: StudentStatus
  auth_user_id: string | null
  created_at: string
  updated_at: string
  // joined
  class?: Class
}

// ---- attendance ----
export interface Attendance {
  id: string
  student_id: string
  class_id: string | null
  date: string              // "2025-09-01"
  status: AttendanceStatus
  checked_in_at: string | null
  method: AttendanceMethod | null
  recorded_by: string | null
  created_at: string
  // joined
  student?: Student
}

// ---- qr_tokens ----
export interface QrToken {
  id: string
  student_id: string
  token: string
  issued_at: string
  expires_at: string
  used: boolean
  used_at: string | null
}

// ---- settings ----
export interface Setting {
  key: string
  value: unknown
  updated_at: string
}

export interface AppSettings {
  qr_token_ttl_seconds: number
  late_threshold_minutes: number
  school_name: string
}

// ---- audit_logs ----
export interface AuditLog {
  id: string
  admin_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

// ---- import_logs ----
export interface ImportLog {
  id: string
  admin_id: string | null
  file_name: string | null
  total_rows: number | null
  success_count: number | null
  failed_rows: FailedRow[] | null
  missing_photos: string[] | null
  created_at: string
}

export interface FailedRow {
  row: number
  student_code: string
  reason: string
}

// ---- API response types ----
export interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

// ---- QR Scan result ----
export type ScanResultCode =
  | 'TOKEN_NOT_FOUND'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_ALREADY_USED'
  | 'STUDENT_INACTIVE'
  | 'ALREADY_MARKED_TODAY'
  | 'NETWORK_ERROR'
  | 'SUCCESS'

export interface ScanResult {
  success: boolean
  code: ScanResultCode
  student?: Pick<Student, 'id' | 'first_name' | 'last_name' | 'photo_url' | 'student_code'>
  class_name?: string
  checked_in_at?: string
  message?: string
}

// ---- Student credentials (import natijasi) ----
export interface StudentCredential {
  student_code: string
  full_name: string
  login: string
  password: string
}

// ---- Attendance stats ----
export type StatsPeriod = 'daily' | 'weekly' | 'monthly'

export interface AttendanceStats {
  total: number
  present: number
  absent: number
  late: number
  excused: number
  attendance_rate: number   // 0–100
}

export interface DailyStats {
  date: string
  stats: AttendanceStats
}
