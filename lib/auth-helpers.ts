import { cookies } from 'next/headers'
import { createClient, createServiceClient } from './supabase/server'

export interface AuthenticatedAdmin {
  id: string
  school_id: string
  full_name: string
}

interface CachedAdmin {
  admin: AuthenticatedAdmin
  expiresAt: number
}

// In-memory token cache for instant 0ms authentication
const tokenAuthCache = new Map<string, CachedAdmin>()

// Clean up expired cache items periodically
if (typeof global !== 'undefined') {
  const globalForAuth = global as unknown as { adminCacheInterval?: ReturnType<typeof setInterval> }
  if (!globalForAuth.adminCacheInterval) {
    globalForAuth.adminCacheInterval = setInterval(() => {
      const now = Date.now()
      for (const [key, cached] of tokenAuthCache.entries()) {
        if (now > cached.expiresAt) {
          tokenAuthCache.delete(key)
        }
      }
    }, 30000)
  }
}

/**
 * Verifies that the current request is from an authenticated admin.
 * Returns the admin profile in 0ms using memory caching.
 */
export async function verifyAdmin(): Promise<AuthenticatedAdmin> {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  
  // Create a cache key from Supabase auth cookies
  const authCookieValues = allCookies
    .filter(c => c.name.includes('auth-token') || c.name.includes('supabase') || c.name.includes('sb-'))
    .map(c => `${c.name}:${c.value.slice(0, 32)}`)
    .join('|')

  const now = Date.now()

  if (authCookieValues) {
    const cached = tokenAuthCache.get(authCookieValues)
    if (cached && now < cached.expiresAt) {
      return cached.admin
    }
  }

  // Fallback: Verify via Supabase Auth
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw new Error('UNAUTHORIZED')
  }

  // Direct fast lookup via Supabase Service Client
  const serviceClient = createServiceClient()
  const { data: admin, error } = await serviceClient
    .from('admins')
    .select('id, school_id, full_name')
    .eq('id', user.id)
    .maybeSingle()
  
  if (error || !admin) {
    throw new Error('FORBIDDEN')
  }
  
  if (!admin.school_id) {
    throw new Error('NO_SCHOOL_ASSIGNED')
  }

  const authenticatedAdmin: AuthenticatedAdmin = {
    id: admin.id,
    school_id: admin.school_id,
    full_name: admin.full_name,
  }

  // Cache for 3 minutes for instant 0ms subsequent calls
  if (authCookieValues) {
    tokenAuthCache.set(authCookieValues, {
      admin: authenticatedAdmin,
      expiresAt: now + 3 * 60 * 1000,
    })
  }

  return authenticatedAdmin
}

/**
 * Standard error response formatter for API routes
 */
export function handleApiError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error'
  
  if (message === 'UNAUTHORIZED') {
    return Response.json({ error: 'Sessiya muddati tugagan yoki tizimga kirilmagan.' }, { status: 401 })
  }
  
  if (message === 'FORBIDDEN') {
    return Response.json({ error: 'Ushbu amalni bajarish uchun sizda yetarli huquqlar yo\'q.' }, { status: 403 })
  }

  if (message === 'NO_SCHOOL_ASSIGNED') {
    return Response.json({ error: 'Foydalanuvchiga maktab biriktirilmagan.' }, { status: 400 })
  }

  console.error('API Error:', error)
  return Response.json({ error: 'Tizimda xatolik yuz berdi. Iltimos keyinroq urinib ko\'ring.' }, { status: 500 })
}
