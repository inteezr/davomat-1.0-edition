'use client'

// Client-side in-memory cache for 0ms instant UI responses
const clientCache = new Map<string, { data: any; timestamp: number }>()

export async function fastFetch<T = any>(
  url: string,
  options?: RequestInit,
  ttlMs = 15000 // 15 seconds instant cache
): Promise<T> {
  const isGet = !options || !options.method || options.method.toUpperCase() === 'GET'
  const now = Date.now()

  // For GET requests, return cached data in 0ms if valid
  if (isGet) {
    const cached = clientCache.get(url)
    if (cached && (now - cached.timestamp) < ttlMs) {
      // Revalidate in background if older than 3 seconds
      if (now - cached.timestamp > 3000) {
        fetch(url, options)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data) clientCache.set(url, { data, timestamp: Date.now() })
          })
          .catch(() => {})
      }
      return cached.data
    }
  }

  // Network fetch
  const res = await fetch(url, options)
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`)
  }
  const data = await res.json()

  if (isGet) {
    clientCache.set(url, { data, timestamp: Date.now() })
  }

  return data
}

export function invalidateClientCache(urlPrefix?: string) {
  if (!urlPrefix) {
    clientCache.clear()
    return
  }
  for (const key of clientCache.keys()) {
    if (key.includes(urlPrefix)) {
      clientCache.delete(key)
    }
  }
}
