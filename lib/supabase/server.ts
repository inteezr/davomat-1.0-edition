import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase client (Server Components, Server Actions, Route Handlers).
 * anon key bilan ishlaydi — RLS qo'llaniladi.
 */
export async function createClient() {
  const cookieStore = await cookies()
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey,
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
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
