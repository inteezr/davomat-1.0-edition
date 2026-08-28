/**
 * Offline Database Manager using IndexedDB
 * Allows 100% offline QR scanning with instant 0ms local lookups
 * and background auto-sync when internet reconnects.
 */

export interface CachedStudent {
  id: string
  student_code: string
  first_name: string
  last_name: string
  class_name: string | null
  photo_url: string | null
  school_id?: string
}

export interface OfflineAttendanceRecord {
  id: string
  token: string
  student_id: string
  student_code: string
  first_name: string
  last_name: string
  class_name: string | null
  photo_url: string | null
  status: 'present' | 'late'
  checked_in_at: string
  synced: boolean
}

const DB_NAME = 'davomat_offline_db'
const DB_VERSION = 1
const STORE_STUDENTS = 'students'
const STORE_QUEUE = 'attendance_queue'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains(STORE_STUDENTS)) {
        const studentStore = db.createObjectStore(STORE_STUDENTS, { keyPath: 'student_code' })
        studentStore.createIndex('id', 'id', { unique: false })
      }

      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const queueStore = db.createObjectStore(STORE_QUEUE, { keyPath: 'id' })
        queueStore.createIndex('synced', 'synced', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Cache all school students locally for offline scanning
 */
export async function cacheStudentsLocally(students: CachedStudent[]): Promise<void> {
  try {
    const db = await openDatabase()
    const tx = db.transaction(STORE_STUDENTS, 'readwrite')
    const store = tx.objectStore(STORE_STUDENTS)

    for (const student of students) {
      if (student.student_code) {
        store.put({
          ...student,
          student_code: student.student_code.trim().toUpperCase()
        })
      }
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.warn('Failed to cache students locally:', err)
  }
}

/**
 * Instant 0ms local lookup for a student by QR code / token
 */
export async function findStudentLocally(codeOrToken: string): Promise<CachedStudent | null> {
  try {
    let cleanCode = codeOrToken.trim()

    // Handle token format like /api/qr/verify?token=XYZ or direct token
    if (cleanCode.includes('token=')) {
      const match = cleanCode.match(/token=([a-zA-Z0-9_\-\.]+)/)
      if (match) cleanCode = match[1]
    } else if (cleanCode.startsWith('http://') || cleanCode.startsWith('https://')) {
      const parts = cleanCode.split('/')
      cleanCode = parts[parts.length - 1]
    }

    // Try decoding base64 json token if formatted
    try {
      if (cleanCode.includes('.')) {
        // JWT format - decode payload
        const parts = cleanCode.split('.')
        if (parts.length >= 2) {
          const payload = JSON.parse(atob(parts[1]))
          if (payload.student_code) cleanCode = payload.student_code
          if (payload.code) cleanCode = payload.code
        }
      }
    } catch {}

    const db = await openDatabase()
    const tx = db.transaction(STORE_STUDENTS, 'readonly')
    const store = tx.objectStore(STORE_STUDENTS)

    // 1. Try exact student_code lookup
    const upper = cleanCode.toUpperCase()
    const req1 = store.get(upper)

    const result = await new Promise<CachedStudent | null>((resolve) => {
      req1.onsuccess = () => {
        if (req1.result) {
          resolve(req1.result)
        } else {
          // 2. Scan all if not direct key
          const cursorReq = store.openCursor()
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result
            if (cursor) {
              const val = cursor.value as CachedStudent
              if (
                val.student_code.toUpperCase() === upper ||
                val.id === cleanCode ||
                upper.includes(val.student_code.toUpperCase())
              ) {
                resolve(val)
                return
              }
              cursor.continue()
            } else {
              resolve(null)
            }
          }
          cursorReq.onerror = () => resolve(null)
        }
      }
      req1.onerror = () => resolve(null)
    })

    return result
  } catch (err) {
    console.warn('Local student lookup error:', err)
    return null
  }
}

/**
 * Save an offline attendance record to the queue
 */
export async function saveOfflineAttendance(record: OfflineAttendanceRecord): Promise<void> {
  try {
    const db = await openDatabase()
    const tx = db.transaction(STORE_QUEUE, 'readwrite')
    const store = tx.objectStore(STORE_QUEUE)
    store.put(record)

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.warn('Failed to save offline attendance record:', err)
  }
}

/**
 * Get all unsynced attendance records from queue
 */
export async function getUnsyncedAttendance(): Promise<OfflineAttendanceRecord[]> {
  try {
    const db = await openDatabase()
    const tx = db.transaction(STORE_QUEUE, 'readonly')
    const store = tx.objectStore(STORE_QUEUE)

    return new Promise((resolve) => {
      const items: OfflineAttendanceRecord[] = []
      const cursorReq = store.openCursor()
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result
        if (cursor) {
          if (!cursor.value.synced) {
            items.push(cursor.value)
          }
          cursor.continue()
        } else {
          resolve(items)
        }
      }
      cursorReq.onerror = () => resolve([])
    })
  } catch {
    return []
  }
}

/**
 * Mark records as synced in local DB
 */
export async function markAttendanceSynced(ids: string[]): Promise<void> {
  try {
    const db = await openDatabase()
    const tx = db.transaction(STORE_QUEUE, 'readwrite')
    const store = tx.objectStore(STORE_QUEUE)

    for (const id of ids) {
      const getReq = store.get(id)
      getReq.onsuccess = () => {
        if (getReq.result) {
          store.put({ ...getReq.result, synced: true })
        }
      }
    }
  } catch (err) {
    console.warn('Failed to mark synced:', err)
  }
}
