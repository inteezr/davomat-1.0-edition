import { createBrowserClient } from '@supabase/ssr'

/**
 * Client-side Supabase client.
 * React komponentlar va client-side hooklar uchun ishlatiladi.
 */
export function createClient() {
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey,
  )
}

