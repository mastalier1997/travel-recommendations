import type { Candidate, DraftRow } from '@/lib/types';
import type { DraftAction } from './draft';

export type GeocodeResult = { candidates: Candidate[] } | { error: string; retryAfterMs?: number };
export type Geocoder = (q: string) => Promise<GeocodeResult>;

export async function fetchGeocoder(q: string): Promise<GeocodeResult> {
  try {
    const res = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ q }),
    });
    const body = await res.json();
    if (!res.ok) return { error: body.error ?? 'Could not reach the geocoder.', retryAfterMs: body.retryAfterMs };
    return body as { candidates: Candidate[] };
  } catch {
    return { error: 'Could not reach the geocoder.' };
  }
}

/**
 * Client concurrency 1 (PLAN.md) — resolves every pending row in `rows`, one at a
 * time, awaited. This only walks the snapshot it's given; it does not watch for new
 * pending rows appearing mid-loop. The caller re-invokes it after `retry`/`retype`
 * resets a row back to pending, or after `add-rows` adds a fresh batch.
 */
export async function resolveAll(
  rows: DraftRow[],
  dispatch: (action: DraftAction) => void,
  geocode: Geocoder = fetchGeocoder,
): Promise<void> {
  for (const row of rows) {
    if (row.state !== 'pending') continue;
    dispatch({ type: 'start-resolving', rowId: row.id });
    const result = await geocode(row.raw);
    if ('error' in result) {
      dispatch({ type: 'geocode-error', rowId: row.id, error: result.error });
    } else {
      dispatch({ type: 'resolved', rowId: row.id, candidates: result.candidates });
    }
  }
}
