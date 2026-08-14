import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/plans';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // Only ever redirect to a path on this origin — `next` arrives from the URL.
    if (!error) return NextResponse.redirect(`${origin}${next.startsWith('/') ? next : '/plans'}`);
  }

  return NextResponse.redirect(`${origin}/login?error=link`);
}
