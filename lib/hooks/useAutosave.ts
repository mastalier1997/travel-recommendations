'use client';

import { useEffect, useRef, useState } from 'react';
import { applyResult, shouldSave, type SaveState } from '@/lib/plan/saveState';
import type { Place, Route } from '@/lib/types';

export type { SaveResult, SaveStatus } from '@/lib/plan/saveState';
import type { SaveResult } from '@/lib/plan/saveState';

type Args = {
  /** False in fixture mode — there is nothing to persist to. */
  enabled: boolean;
  places: Place[];
  route: Route | null;
  initialVersion: number;
  /** True mid-drag. */
  paused: boolean;
  onSave: (input: {
    places: Place[];
    route: Route | null;
    version: number;
  }) => Promise<SaveResult>;
  debounceMs?: number;
};

/**
 * Debounced write-behind. The decision rules live in lib/plan/saveState.ts so they
 * can be checked without a DOM; this hook is only the timer and the wiring.
 */
export function useAutosave({
  enabled,
  places,
  route,
  initialVersion,
  paused,
  onSave,
  debounceMs = 1500,
}: Args): { status: SaveState['status']; error: string | null } {
  const [state, setState] = useState<SaveState>({
    status: 'idle',
    version: initialVersion,
    error: null,
  });

  // Held in a ref as well so an in-flight save reads the current version without
  // the effect having to depend on state and re-arm itself.
  const stateRef = useRef(state);
  stateRef.current = state;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const primed = useRef(false);

  useEffect(() => {
    if (!primed.current) {
      primed.current = true;
      return;
    }
    if (!shouldSave({ enabled, primed: true, paused, status: stateRef.current.status })) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      setState((s) => ({ ...s, status: 'saving' }));

      const result = await onSave({ places, route, version: stateRef.current.version });

      inFlight.current = false;
      setState((s) => applyResult(s, result));
    }, debounceMs);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, places, route, paused, onSave, debounceMs]);

  return { status: state.status, error: state.error };
}
