'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { SaveResult } from '@/lib/hooks/useAutosave';
import type { Place, Route } from '@/lib/types';
import { normalizeTitle, type RenameResult } from '@/lib/plan/title';

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

/**
 * Deliberately NOT version-conditional, unlike savePlan above — and deliberately
 * doesn't touch `updated_at` (a rename isn't a content edit; both `/plans` and the
 * plan switcher sort by it, so bumping it would silently reorder those lists out
 * from under the user).
 *
 * A version guard here would be actively harmful, not just redundant: rename would
 * have to bump `version` to mean anything, and the next debounced places/route
 * autosave (which still holds the pre-rename version) would then be rejected as a
 * conflict — terminal, per lib/plan/saveState.ts — silently losing real itinerary
 * edits over a title change. savePlan's guard exists because it's a whole-document
 * replacement from a client-held snapshot; this writes one scalar the user can see
 * as they type it, so last-write-wins is the correct semantics, not a compromise.
 *
 * Returns a dedicated result type rather than SaveResult on purpose — reusing that
 * shape risks a `version`/`conflict` value from this action leaking into
 * useAutosave's conflict handling for a save it never made.
 */
export async function renamePlan(id: string, title: string): Promise<RenameResult> {
  const normalized = normalizeTitle(title);
  if (!normalized.ok) return { ok: false, error: 'Enter a name for this plan.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('plans')
    .update({ title: normalized.title })
    .eq('id', id)
    .select('title')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  // No version predicate to fail on, so zero rows means the plan is gone or RLS
  // hides it — not a conflict with someone else's edit.
  if (!data) return { ok: false, missing: true };

  revalidatePath('/plans');
  revalidatePath(`/plans/${id}`);
  return { ok: true, title: data.title as string };
}
