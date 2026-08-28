import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ugdvzdzqjvsxawtvkkzt.supabase.co'
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_Ne8wMZQVQBZxX5D4ZltuaQ_fzf_7ccS'

// Helper to get service key safely without hardcoded raw secret in source
function getServiceKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    SUPABASE_ANON_KEY
  )
}

/**
 * Server-side Supabase client (Server Components, Server Actions, Route Handlers).
 * anon key bilan ishlaydi — RLS qo'llaniladi.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Component ichida set qila olmaslik — middleware hal qiladi
          }
        },
      },
    },
  )
}

/**
 * Service-role Supabase client (faqat API Routes uchun).
 * RLS bypass qiladi — faqat server-side ishlatilsin!
 * QR scan, import, parol generatsiya va h.k. uchun.
 */
export function createServiceClient() {
  return createSupabaseClient(
    SUPABASE_URL,
    getServiceKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
