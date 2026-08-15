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

export type SaveDecision = 'save' | 'defer' | 'skip';

/**
 * `shouldSave` plus one more axis: whether a save is already in flight. Kept
 * separate from `shouldSave` rather than folded in, since only the hook (not the
 * three existing callers of `shouldSave`-shaped logic) needs to know about `inFlight`.
 *
 * 'defer' means an edit arrived while a save was in flight — the caller marks it
 * pending and retries once that save resolves (see `shouldRetryAfterInFlight`),
 * rather than the old behaviour of silently discarding the edit.
 */
export function decideSave(args: {
  enabled: boolean;
  primed: boolean;
  paused: boolean;
  status: SaveStatus;
  inFlight: boolean;
}): SaveDecision {
  if (!shouldSave(args)) return 'skip';
  return args.inFlight ? 'defer' : 'save';
}

/**
 * Whether a save deferred by `decideSave` should actually re-run once the in-flight
 * one finishes. Not on conflict — that is terminal until the user reloads, and
 * retrying would just replay the same lost race against a version that has already
 * diverged.
 */
export function shouldRetryAfterInFlight(pending: boolean, status: SaveStatus): boolean {
  return pending && status !== 'conflict';
}
