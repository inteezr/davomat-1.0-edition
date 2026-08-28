/**
 * Global Offline-First Database Manager using IndexedDB
 * Provides 0ms instant UI responses for all pages (Dashboard, Students, Classes, Attendance, Scanner)
 * and seamless background synchronization when online.
 */

export interface CachedStudent {
  id: string
  student_code: string
  first_name: string
  last_name: string
  class_id?: string | null
  class_name: string | null
  photo_url: string | null
  phone?: string | null
  parent_phone?: string | null
  status?: 'active' | 'inactive'
  school_id?: string
}

export interface CachedClass {
  id: string
  name: string
  grade?: number | null
  student_count?: number
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
  status: 'present' | 'late' | 'excused' | 'absent'
  checked_in_at: string
  synced: boolean
}

export interface OfflineMutationTask {
  id: string
  type: 'attendance_scan' | 'attendance_manual' | 'attendance_excuse' | 'student_create' | 'student_update'
  payload: any
  createdAt: number
  synced: boolean
}

const DB_NAME = 'davomat_platform_offline_db'
const DB_VERSION = 2
const STORE_STUDENTS = 'students'
const STORE_CLASSES = 'classes'
const STORE_ATTENDANCE = 'attendance_records'
const STORE_STATS = 'dashboard_stats'
const STORE_QUEUE = 'sync_queue'

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
        const studentStore = db.createObjectStore(STORE_STUDENTS, { keyPath: 'id' })
        studentStore.createIndex('student_code', 'student_code', { unique: false })
        studentStore.createIndex('class_id', 'class_id', { unique: false })
      }

      if (!db.objectStoreNames.contains(STORE_CLASSES)) {
        db.createObjectStore(STORE_CLASSES, { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains(STORE_ATTENDANCE)) {
        const attStore = db.createObjectStore(STORE_ATTENDANCE, { keyPath: 'id' })
        attStore.createIndex('student_id', 'student_id', { unique: false })
        attStore.createIndex('date', 'date', { unique: false })
      }

      if (!db.objectStoreNames.contains(STORE_STATS)) {
        db.createObjectStore(STORE_STATS, { keyPath: 'key' })
      }

      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const queueStore = db.createObjectStore(STORE_QUEUE, { keyPath: 'id' })
        queueStore.createIndex('synced', 'synced', { unique: false })
        queueStore.createIndex('type', 'type', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/* ============================================================
   1. STUDENTS LOCAL CACHE (0ms lookups)
   ============================================================ */

export async function cacheStudentsLocally(students: CachedStudent[]): Promise<void> {
  try {
    const db = await openDatabase()
    const tx = db.transaction(STORE_STUDENTS, 'readwrite')
    const store = tx.objectStore(STORE_STUDENTS)

    for (const student of students) {
      if (student.id) {
        store.put({
          ...student,
          student_code: (student.student_code || '').trim().toUpperCase()
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

export async function getLocalStudents(classId?: string): Promise<CachedStudent[]> {
  try {
    const db = await openDatabase()
    const tx = db.transaction(STORE_STUDENTS, 'readonly')
    const store = tx.objectStore(STORE_STUDENTS)

    return new Promise((resolve) => {
      const results: CachedStudent[] = []
      const req = store.openCursor()
      req.onsuccess = () => {
        const cursor = req.result
        if (cursor) {
          const val = cursor.value as CachedStudent
          if (!classId || val.class_id === classId) {
            results.push(val)
          }
          cursor.continue()
        } else {
          resolve(results)
        }
      }
      req.onerror = () => resolve([])
    })
  } catch {
    return []
  }
}

export async function findStudentLocally(codeOrToken: string): Promise<CachedStudent | null> {
  try {
    let cleanCode = codeOrToken.trim()

    if (cleanCode.includes('token=')) {
      const match = cleanCode.match(/token=([a-zA-Z0-9_\-\.]+)/)
      if (match) cleanCode = match[1]
    } else if (cleanCode.startsWith('http://') || cleanCode.startsWith('https://')) {
      const parts = cleanCode.split('/')
      cleanCode = parts[parts.length - 1]
    }

    try {
      if (cleanCode.includes('.')) {
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

    const upper = cleanCode.toUpperCase()

    return new Promise<CachedStudent | null>((resolve) => {
      const cursorReq = store.openCursor()
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result
        if (cursor) {
          const val = cursor.value as CachedStudent
          if (
            (val.student_code && val.student_code.toUpperCase() === upper) ||
            val.id === cleanCode ||
            (val.student_code && upper.includes(val.student_code.toUpperCase()))
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
    })
  } catch (err) {
    console.warn('Local student lookup error:', err)
    return null
  }
}

/* ============================================================
   2. CLASSES LOCAL CACHE
   ============================================================ */

export async function cacheClassesLocally(classes: CachedClass[]): Promise<void> {
  try {
    const db = await openDatabase()
    const tx = db.transaction(STORE_CLASSES, 'readwrite')
    const store = tx.objectStore(STORE_CLASSES)

    for (const c of classes) {
      if (c.id) store.put(c)
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.warn('Failed to cache classes locally:', err)
  }
}

export async function getLocalClasses(): Promise<CachedClass[]> {
  try {
    const db = await openDatabase()
    const tx = db.transaction(STORE_CLASSES, 'readonly')
    const store = tx.objectStore(STORE_CLASSES)

    return new Promise((resolve) => {
      const results: CachedClass[] = []
      const req = store.openCursor()
      req.onsuccess = () => {
        const cursor = req.result
        if (cursor) {
          results.push(cursor.value)
          cursor.continue()
        } else {
          resolve(results)
        }
      }
      req.onerror = () => resolve([])
    })
  } catch {
    return []
  }
}

/* ============================================================
   3. STATS & ATTENDANCE LOCAL CACHE
   ============================================================ */

export async function cacheStatsLocally(key: string, data: any): Promise<void> {
  try {
    const db = await openDatabase()
    const tx = db.transaction(STORE_STATS, 'readwrite')
    const store = tx.objectStore(STORE_STATS)
    store.put({ key, data, updatedAt: Date.now() })
  } catch (err) {
    console.warn('Failed to cache stats locally:', err)
  }
}

export async function getLocalStats(key: string): Promise<any | null> {
  try {
    const db = await openDatabase()
    const tx = db.transaction(STORE_STATS, 'readonly')
    const store = tx.objectStore(STORE_STATS)

    return new Promise((resolve) => {
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result ? req.result.data : null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

/* ============================================================
   4. SYNC QUEUE & BACKGROUND TASKS
   ============================================================ */

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
