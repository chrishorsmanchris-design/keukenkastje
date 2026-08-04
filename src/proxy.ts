import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

const intlMiddleware = createIntlMiddleware(routing)

const AUTH_PATHS = ['/login', '/registreren', '/wachtwoord', '/invite', '/join']

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Publieke pagina's: geen auth-check nodig, scheelt een ronde naar Supabase.
  if (AUTH_PATHS.some((p) => pathname.includes(p))) {
    return intlMiddleware(request)
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getClaims valideert het JWT lokaal wanneer dat kan, in plaats van elke
  // request naar de Supabase auth-server te sturen. Als dat onverwacht
  // mislukt, vallen we terug op getUser zodat niemand buitengesloten raakt.
  let isLoggedIn = false
  try {
    const { data, error } = await supabase.auth.getClaims()
    if (error) throw error
    isLoggedIn = Boolean(data?.claims)
  } catch {
    const { data: { user } } = await supabase.auth.getUser()
    isLoggedIn = Boolean(user)
  }

  if (!isLoggedIn) {
    const url = request.nextUrl.clone()
    url.pathname = '/nl/login'
    return NextResponse.redirect(url)
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
