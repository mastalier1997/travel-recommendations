import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/supabase/redirect';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'), origin);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(new URL(next, origin));
      // Marks "this browser has completed a real sign-in", so a later session
      // expiry can be told apart from a first-time visit on /login.
      response.cookies.set('wl_seen', '1', { path: '/', maxAge: 60 * 60 * 24 * 400, sameSite: 'lax' });
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link`);
}
