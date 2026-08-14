'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function createPlan(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const title = String(formData.get('title') ?? '').trim() || 'Untitled plan';

  const { data, error } = await supabase
    .from('plans')
    // user_id is not defaulted in the schema, and the RLS check requires it to match.
    .insert({ user_id: user.id, title, places: [], route: null })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  revalidatePath('/plans');
  redirect(`/plans/${data.id}`);
}

export async function deletePlan(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from('plans').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/plans');
}
