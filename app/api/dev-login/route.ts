import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ponytail: local-only shortcut around magic-link so `npm run dev` doesn't need
// a real inbox. Blocked outside development; upgrade path is a real Supabase
// project per developer if that ever matters.
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({
    email: 'dev@local.test',
    password: 'devdevdev',
  });

  return NextResponse.redirect(new URL('/plans', request.url));
}
