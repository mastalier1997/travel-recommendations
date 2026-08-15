'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Without this, the client router cache keeps serving signed-in pages (e.g. the
  // /plans list) until an unrelated navigation happens to bust it.
  revalidatePath('/', 'layout');
  redirect('/login');
}
