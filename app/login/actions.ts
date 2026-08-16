'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function signOut() {
  const supabase = await createClient();
  // 'local' scope: end this device's session only. The default ('global') would
  // revoke every device's refresh token, which breaks the "stay signed in for a
  // month, unless you sign out" promise for anyone with more than one device.
  await supabase.auth.signOut({ scope: 'local' });
  // Without this, the client router cache keeps serving signed-in pages (e.g. the
  // /plans list) until an unrelated navigation happens to bust it.
  revalidatePath('/', 'layout');
  redirect('/login?reason=signedout');
}
