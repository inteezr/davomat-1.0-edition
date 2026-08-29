import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/', '/landing', '/login', '/download']

function isPublicPath(pathname: string) {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Skip API routes entirely (handled inside route handlers via verifyAdmin)
  if (pathname.startsWith('/api')) {
    return NextResponse.next({ request })
  }

  const isPublic = isPublicPath(pathname)
  const allCookies = request.cookies.getAll()
  const hasAuthCookie = allCookies.some(
    (c) => c.name.includes('sb-') || c.name.includes('supabase') || c.name.includes('auth-token')
  )

  // 2. Fast Path: Public routes without auth cookie (0ms)
  if (isPublic && !hasAuthCookie && pathname !== '/login') {
    return NextResponse.next({ request })
  }

  // 3. Ultra-Fast Client Navigation (RSC / Next Router Transitions)
  // When navigating between pages inside the SPA, avoid making blocking remote network calls to Supabase.
  const isRscOrPrefetch =
    request.headers.get('rsc') === '1' ||
    request.headers.get('next-router-prefetch') === '1' ||
    request.headers.get('next-router-state-tree') !== null

  if (isRscOrPrefetch && hasAuthCookie) {
    // Instant 0ms passthrough for client-side navigation
    return NextResponse.next({ request })
  }

  // 4. Full browser navigation: If no auth cookie on a protected route, redirect to /login immediately (0ms)
  if (!hasAuthCookie && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 5. If on /login with valid auth cookie, redirect to /dashboard
  if (hasAuthCookie && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ugdvzdzqjvsxawtvkkzt.supabase.co'
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    'sb_publishable_Ne8wMZQVQBZxX5D4ZltuaQ_fzf_7ccS'

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Refresh session in background / initial full page load
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files & images
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)$).*)',
  ],
}
