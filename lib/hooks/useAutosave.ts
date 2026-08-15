'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { applyResult, decideSave, shouldRetryAfterInFlight, type SaveState } from '@/lib/plan/saveState';
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
 *
 * `onSave` (a bound server action) does not have a stable identity across renders —
 * invoking it re-renders the server tree that created it, producing a new function
 * every time. It's held in a ref, not the effect's dependency array, so a save
 * completing can never itself re-arm the timer. `places`/`route` are also read from
 * refs at call time, not closed over, so a save deferred by `decideSave` (one that
 * arrived while a previous save was still in flight) retries with the latest edit
 * instead of the stale snapshot from when it was first scheduled.
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

  const stateRef = useRef(state);
  stateRef.current = state;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const placesRef = useRef(places);
  placesRef.current = places;
  const routeRef = useRef(route);
  routeRef.current = route;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const pending = useRef(false);
  const primed = useRef(false);

  const runSave = useCallback(async () => {
    inFlight.current = true;
    setState((s) => ({ ...s, status: 'saving' }));

    const result = await onSaveRef.current({
      places: placesRef.current,
      route: routeRef.current,
      version: stateRef.current.version,
    });

    inFlight.current = false;
    const next = applyResult(stateRef.current, result);
    stateRef.current = next;
    setState(next);

    // An edit that arrived mid-flight was deferred, not dropped — pick it up now,
    // against whatever places/route are current, unless the save that just landed
    // was a conflict (terminal; see shouldRetryAfterInFlight).
    if (shouldRetryAfterInFlight(pending.current, next.status)) {
      pending.current = false;
      void runSave();
    } else {
      pending.current = false;
    }
  }, []);

  useEffect(() => {
    if (!primed.current) {
      primed.current = true;
      return;
    }

    const decision = decideSave({
      enabled,
      primed: true,
      paused,
      status: stateRef.current.status,
      inFlight: inFlight.current,
    });

    if (decision === 'skip') return;
    if (decision === 'defer') {
      pending.current = true;
      return;
    }

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void runSave(), debounceMs);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, places, route, paused, debounceMs, runSave]);

  return { status: state.status, error: state.error };
}
