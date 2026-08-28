'use client'

import { 
  cacheStatsLocally, 
  getLocalStats, 
  cacheStudentsLocally, 
  cacheClassesLocally, 
  getLocalStudents, 
  getLocalClasses 
} from './offline-db'

// In-memory instant cache
const memoryCache = new Map<string, { data: any; timestamp: number }>()

/**
 * Ultra-Fast 0ms Local-First Data Fetcher
 * 1. Checks Memory Cache (0.01ms)
 * 2. Checks IndexedDB Offline Storage (0.1ms)
 * 3. Returns immediately to the UI
 * 4. Silently revalidates and syncs with server in the background
 */
export async function fastFetch<T = any>(
  url: string,
  options?: RequestInit,
  ttlMs = 30000 // 30 seconds instant memory cache
): Promise<T> {
  const isGet = !options || !options.method || options.method.toUpperCase() === 'GET'
  const now = Date.now()

  if (isGet) {
    // 1. Memory cache check (0.01ms)
    const memEntry = memoryCache.get(url)
    if (memEntry && (now - memEntry.timestamp) < ttlMs) {
      // Background revalidation if older than 5 seconds
      if (now - memEntry.timestamp > 5000 && typeof window !== 'undefined' && navigator.onLine) {
        backgroundRevalidate(url, options)
      }
      return memEntry.data
    }

    // 2. IndexedDB local storage check (0.1ms)
    if (typeof window !== 'undefined') {
      try {
        if (url.includes('/api/attendance/stats')) {
          const localStats = await getLocalStats(url)
          if (localStats) {
            memoryCache.set(url, { data: localStats, timestamp: now })
            if (navigator.onLine) backgroundRevalidate(url, options)
            return localStats
          }
        } else if (url.includes('/api/classes')) {
          const localClasses = await getLocalClasses()
          if (localClasses && localClasses.length > 0) {
            const data = { data: localClasses }
            memoryCache.set(url, { data, timestamp: now })
            if (navigator.onLine) backgroundRevalidate(url, options)
            return data as any
          }
        } else if (url.includes('/api/students') && !url.includes('/next-code')) {
          const localStudents = await getLocalStudents()
          if (localStudents && localStudents.length > 0) {
            const data = { data: localStudents, total: localStudents.length, page: 1, totalPages: 1 }
            memoryCache.set(url, { data, timestamp: now })
            if (navigator.onLine) backgroundRevalidate(url, options)
            return data as any
          }
        }
      } catch {}
    }
  }

  // 3. Network fetch
  try {
    const res = await fetch(url, options)
    if (!res.ok) {
      // If offline/error, return any cached stale data if available
      const fallback = memoryCache.get(url)
      if (fallback) return fallback.data
      throw new Error(`HTTP error! status: ${res.status}`)
    }

    const data = await res.json()

    if (isGet) {
      memoryCache.set(url, { data, timestamp: Date.now() })
      // Persist to IndexedDB
      persistToLocalDb(url, data)
    }

    return data
  } catch (err) {
    const fallback = memoryCache.get(url)
    if (fallback) return fallback.data
    throw err
  }
}

// Background revalidation without blocking UI
function backgroundRevalidate(url: string, options?: RequestInit) {
  fetch(url, options)
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (data) {
        memoryCache.set(url, { data, timestamp: Date.now() })
        persistToLocalDb(url, data)
      }
    })
    .catch(() => {})
}

// Helper to save to IndexedDB based on route
function persistToLocalDb(url: string, data: any) {
  if (typeof window === 'undefined') return

  try {
    if (url.includes('/api/attendance/stats')) {
      cacheStatsLocally(url, data)
    } else if (url.includes('/api/classes') && data?.data) {
      cacheClassesLocally(data.data)
    } else if (url.includes('/api/students') && data?.data) {
      cacheStudentsLocally(data.data)
    }
  } catch {}
}

export function invalidateClientCache(urlPrefix?: string) {
  if (!urlPrefix) {
    memoryCache.clear()
    return
  }
  for (const key of memoryCache.keys()) {
    if (key.includes(urlPrefix)) {
      memoryCache.delete(key)
    }
  }
}
