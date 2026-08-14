'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { SaveResult } from '@/lib/hooks/useAutosave';
import type { Place, Route } from '@/lib/types';

/**
 * Conditional on `version`, so a second tab holding a stale copy loses instead of
 * silently overwriting the whole document. The caller surfaces the conflict rather
 * than retrying — the two versions have genuinely diverged and only a human can pick.
 *
 * `id` is first so the page can bind it: savePlan.bind(null, plan.id).
 */
export async function savePlan(
  id: string,
  input: { places: Place[]; route: Route | null; version: number },
): Promise<SaveResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('plans')
    .update({
      places: input.places,
      route: input.route,
      version: input.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('version', input.version)
    .select('version')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  // Zero rows means either the version moved or RLS hid the row. Both are conflicts
  // from the client's point of view: its copy is not the truth any more.
  if (!data) return { ok: false, conflict: true };

  revalidatePath('/plans');
  return { ok: true, version: data.version as number };
}

/**
 * Track I's commit step. Appends imported places to whatever the plan's `places`
 * currently are server-side — the import flow never held the full array, only the
 * rows it just resolved — under the same version-conditional guard as savePlan.
 */
export async function commitImportedPlaces(
  id: string,
  input: { newPlaces: Place[]; version: number },
): Promise<SaveResult> {
  const supabase = await createClient();

  const { data: current, error: readError } = await supabase
    .from('plans')
    .select('places, version')
    .eq('id', id)
    .maybeSingle();

  if (readError) return { ok: false, error: readError.message };
  if (!current || current.version !== input.version) return { ok: false, conflict: true };

  const places = [...((current.places as Place[]) ?? []), ...input.newPlaces];

  const { data, error } = await supabase
    .from('plans')
    .update({ places, version: input.version + 1, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('version', input.version)
    .select('version')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, conflict: true };

  revalidatePath(`/plans/${id}`);
  revalidatePath('/plans');
  return { ok: true, version: data.version as number };
}

export async function renamePlan(id: string, title: string): Promise<SaveResult> {
  const supabase = await createClient();
  const clean = title.trim().slice(0, 120) || 'Untitled plan';

  const { data, error } = await supabase
    .from('plans')
    .update({ title: clean, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('version')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, conflict: true };

  revalidatePath('/plans');
  return { ok: true, version: data.version as number };
}
