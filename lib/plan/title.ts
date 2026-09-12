/**
 * Plan title normalization. Pure, so the rename form's client-side check and the
 * server action can never disagree about what counts as a valid title.
 */

export const MAX_TITLE_LENGTH = 120;

export type NormalizeTitleResult = { ok: true; title: string } | { ok: false; reason: 'empty' };

export function normalizeTitle(raw: string): NormalizeTitleResult {
  const trimmed = raw.trim().slice(0, MAX_TITLE_LENGTH);
  if (!trimmed) return { ok: false, reason: 'empty' };
  return { ok: true, title: trimmed };
}

/** renamePlan's result shape (app/plans/[id]/actions.ts) — kept here, not in that
 * 'use server' file, so a client component can import the type without reaching
 * into server-action-only code (same reason SaveResult lives in lib/plan/saveState.ts
 * rather than inside the action that returns it). */
export type RenameResult =
  | { ok: true; title: string }
  | { ok: false; error: string }
  | { ok: false; missing: true };
