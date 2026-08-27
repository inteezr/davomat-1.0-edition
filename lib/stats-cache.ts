// In-memory stats cache for instant 0ms responses across API routes
// Supports multiple concurrent cache keys (by school_id + date range combos)
const cacheStore = new Map<string, { data: any; expiresAt: number }>()

export function getStatsCache(key: string) {
  const now = Date.now()
  const entry = cacheStore.get(key)
  if (entry && now < entry.expiresAt) {
    return entry.data
  }
  if (entry) cacheStore.delete(key)
  return null
}

export function setStatsCache(key: string, data: any, ttlMs = 2500) {
  cacheStore.set(key, {
    data,
    expiresAt: Date.now() + ttlMs
  })
}

export function clearStatsCache() {
  cacheStore.clear()
}
