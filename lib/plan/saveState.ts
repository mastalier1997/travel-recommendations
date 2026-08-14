export type SaveResult =
  | { ok: true; version: number }
  | { ok: false; conflict: true }
  | { ok: false; error: string };

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

export type SaveState = { status: SaveStatus; version: number; error: string | null };

/**
 * The three rules that decide whether an edit is written. Pulled out of the hook so
 * they are checkable without a DOM: the conflict rule in particular is the one that
 * would otherwise cost a user their work.
 */
export function shouldSave(args: {
  enabled: boolean;
  /** False on the very first render — that is a load, not an edit. */
  primed: boolean;
  /** True mid-drag; writing on every frame of a reorder is pointless traffic. */
  paused: boolean;
  status: SaveStatus;
}): boolean {
  if (!args.enabled || !args.primed || args.paused) return false;
  // Terminal until the user reloads. Retrying would just lose the same race again.
  if (args.status === 'conflict') return false;
  return true;
}

export function applyResult(current: SaveState, result: SaveResult): SaveState {
  if (result.ok) return { status: 'saved', version: result.version, error: null };
  if ('conflict' in result) return { ...current, status: 'conflict', error: null };
  return { ...current, status: 'error', error: result.error };
}
