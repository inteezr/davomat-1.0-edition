interface RateLimitStore {
  count: number
  resetTime: number
}

const stores = new Map<string, RateLimitStore>()

/**
 * Clean up expired rate limit keys periodically
 */
if (typeof global !== 'undefined') {
  const globalForLimiter = global as unknown as { rateLimitInterval?: ReturnType<typeof setInterval> }
  if (!globalForLimiter.rateLimitInterval) {
    globalForLimiter.rateLimitInterval = setInterval(() => {
      const now = Date.now()
      for (const [key, store] of stores.entries()) {
        if (now > store.resetTime) {
          stores.delete(key)
        }
      }
    }, 60000) // Cleanup every minute
  }
}

/**
 * Direct in-memory rate limiter for server routes.
 * Returns true if request is allowed, false if rate limited.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const currentStore = stores.get(key)

  if (!currentStore) {
    stores.set(key, {
      count: 1,
      resetTime: now + windowMs
    })
    return true
  }

  if (now > currentStore.resetTime) {
    // Window expired, reset
    currentStore.count = 1
    currentStore.resetTime = now + windowMs
    return true
  }

  if (currentStore.count >= limit) {
    // Rate limit hit
    return false
  }

  currentStore.count++
  return true
}
