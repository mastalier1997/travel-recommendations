import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/lib/supabase/config';
import { safeNext } from '@/lib/supabase/redirect';

// Set on the callback route after a real sign-in; distinguishes "session expired"
// from "never signed in" for the message shown on /login. Not itself a security
// check — just UX copy.
const SEEN_COOKIE = 'wl_seen';

/**
 * Refreshes the auth cookie on every request. Server Components cannot write
 * cookies, so without this a session would silently expire mid-visit.
 */
export async function middleware(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;

  if (!isSupabaseConfigured) {
    // Every /plans route builds a Supabase client, which throws on an empty URL.
    // Send people to /login, which explains what is missing.
    if (pathname.startsWith('/plans')) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Do not remove: this call is what performs the refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Carries any cookie writes getUser() just made (refreshed tokens, or the
  // clearing of an expired session) onto a redirect response — otherwise a
  // redirect built fresh would silently drop them.
  const redirectWithCookies = (url: URL) => {
    const redirected = NextResponse.redirect(url);
    response.headers.getSetCookie().forEach((cookie) => redirected.headers.append('set-cookie', cookie));
    return redirected;
  };

  if (user) {
    // Signed in and revisiting the login screen (or the root door) — skip straight
    // to their plans instead of showing the form again.
    if (pathname.startsWith('/login')) {
      const dest = safeNext(request.nextUrl.searchParams.get('next'), origin);
      return redirectWithCookies(new URL(dest, origin));
    }
    if (pathname === '/') {
      return redirectWithCookies(new URL('/plans', origin));
    }
    return response;
  }

  const requiresAuth = pathname === '/' || pathname.startsWith('/plans');
  if (requiresAuth) {
    const url = new URL('/login', origin);
    if (pathname !== '/') url.searchParams.set('next', pathname);
    if (request.cookies.get(SEEN_COOKIE)) url.searchParams.set('reason', 'expired');
    return redirectWithCookies(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
