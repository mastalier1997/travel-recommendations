import { describe, it, expect, vi } from 'vitest';
import { resolveAll, type GeocodeResult } from './resolve';
import type { Candidate, DraftRow } from '@/lib/types';
import type { DraftAction } from './draft';

const candidate: Candidate = {
  name: 'Fushimi Inari Taisha',
  address: '68 Fukakusa Yabunouchichō, Fushimi-ku, Kyoto',
  lat: 34.9671,
  lon: 135.7727,
  osm: { type: 'way', id: 32952536, class: 'historic', tag: 'shrine' },
  wikidata: null,
  wikipedia: null,
  importance: 0.6,
  class: 'historic',
  tag: 'shrine',
};

function row(id: string, raw: string, state: DraftRow['state'] = 'pending'): DraftRow {
  return { id, raw, state, candidates: [], selectedIndex: null, decision: null, origin: 'line' };
}

describe('resolveAll', () => {
  it('resolves a single pending row: start-resolving then resolved', async () => {
    const dispatched: DraftAction[] = [];
    const geocode = vi.fn(async (): Promise<GeocodeResult> => ({ candidates: [candidate] }));

    await resolveAll([row('r1', 'Fushimi Inari')], (a) => dispatched.push(a), geocode);

    expect(geocode).toHaveBeenCalledWith('Fushimi Inari');
    expect(dispatched).toEqual([
      { type: 'start-resolving', rowId: 'r1' },
      { type: 'resolved', rowId: 'r1', candidates: [candidate] },
    ]);
  });

  it('skips rows that are not pending', async () => {
    const dispatched: DraftAction[] = [];
    const geocode = vi.fn(async (): Promise<GeocodeResult> => ({ candidates: [] }));

    await resolveAll(
      [row('r1', 'a', 'multiple'), row('r2', 'b', 'error'), row('r3', 'c', 'resolving')],
      (a) => dispatched.push(a),
      geocode,
    );

    expect(geocode).not.toHaveBeenCalled();
    expect(dispatched).toEqual([]);
  });

  it('processes multiple pending rows sequentially, one at a time', async () => {
    const order: string[] = [];
    const dispatched: DraftAction[] = [];
    const geocode = vi.fn(async (q: string): Promise<GeocodeResult> => {
      order.push(`start:${q}`);
      await Promise.resolve();
      order.push(`end:${q}`);
      return { candidates: [] };
    });

    await resolveAll(
      [row('r1', 'a'), row('r2', 'b')],
      (a) => dispatched.push(a),
      geocode,
    );

    // If these ran concurrently, both "start" entries would appear before either "end".
    expect(order).toEqual(['start:a', 'end:a', 'start:b', 'end:b']);
    expect(dispatched.map((a) => a.type)).toEqual([
      'start-resolving',
      'resolved',
      'start-resolving',
      'resolved',
    ]);
  });

  it('dispatches geocode-error when the geocoder returns an error', async () => {
    const dispatched: DraftAction[] = [];
    const geocode = vi.fn(async (): Promise<GeocodeResult> => ({ error: 'Could not reach the geocoder.' }));

    await resolveAll([row('r1', 'a')], (a) => dispatched.push(a), geocode);

    expect(dispatched).toEqual([
      { type: 'start-resolving', rowId: 'r1' },
      { type: 'geocode-error', rowId: 'r1', error: 'Could not reach the geocoder.' },
    ]);
  });
});
