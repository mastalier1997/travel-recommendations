import { describe, it, expect } from 'vitest';
import {
  createDraft,
  draftReducer,
  isReadyToCommit,
  toPlaces,
  unresolvedCount,
  type DraftAction,
} from './draft';
import { MAX_DRAFT_ROWS, type Candidate, type ImportDraft } from '@/lib/types';

const cand = (over: Partial<Candidate> = {}): Candidate => ({
  name: 'Kiyomizu-dera',
  address: 'Kyoto, Japan',
  lat: 34.9949,
  lon: 135.785,
  osm: { type: 'way', id: 1, class: 'historic', tag: 'temple' },
  wikidata: null,
  wikipedia: 'en:Kiyomizu-dera',
  importance: 0.71,
  class: 'historic',
  tag: 'temple',
  ...over,
});

const apply = (draft: ImportDraft, ...actions: DraftAction[]) =>
  actions.reduce(draftReducer, draft);

describe('createDraft', () => {
  it('starts empty', () => {
    const d = createDraft('plan_1', 'paste');
    expect(d).toMatchObject({ planId: 'plan_1', sourceKind: 'paste', rows: [], rawText: '' });
  });
});

describe('add-rows', () => {
  it('splits pasted text into pending rows', () => {
    const d = apply(
      createDraft('p', 'paste'),
      { type: 'add-rows', text: 'Fushimi Inari\nNishiki Market', origin: 'line' },
    );
    expect(d.rows).toHaveLength(2);
    expect(d.rows.every((r) => r.state === 'pending')).toBe(true);
    expect(d.rows.map((r) => r.origin)).toEqual(['line', 'line']);
  });

  it('tags prose-scanned rows with origin prose', () => {
    const d = apply(createDraft('p', 'paste'), {
      type: 'add-rows',
      text: 'We visited Fushimi Inari today.',
      origin: 'prose',
    });
    expect(d.rows[0]?.origin).toBe('prose');
  });

  it('does not add a raw string twice, case- and whitespace-insensitively', () => {
    const d = apply(
      createDraft('p', 'paste'),
      { type: 'add-rows', text: 'Fushimi Inari', origin: 'line' },
      { type: 'add-rows', text: '  fushimi   inari  ', origin: 'line' },
    );
    expect(d.rows).toHaveLength(1);
  });

  it('caps total rows at MAX_DRAFT_ROWS', () => {
    const many = Array.from({ length: MAX_DRAFT_ROWS + 20 }, (_, i) => `Place ${i}`).join('\n');
    const d = apply(createDraft('p', 'paste'), { type: 'add-rows', text: many, origin: 'line' });
    expect(d.rows).toHaveLength(MAX_DRAFT_ROWS);
  });

  it('appends to rawText across multiple adds', () => {
    const d = apply(
      createDraft('p', 'paste'),
      { type: 'add-rows', text: 'A', origin: 'line' },
      { type: 'add-rows', text: 'B', origin: 'line' },
    );
    expect(d.rawText).toBe('A\nB');
  });
});

describe('resolving a row', () => {
  function seeded() {
    return apply(createDraft('p', 'paste'), {
      type: 'add-rows',
      text: 'kiyomizu temple',
      origin: 'line',
    });
  }

  it('moves a row to resolving', () => {
    const base = seeded();
    const [row] = base.rows;
    const d = draftReducer(base, { type: 'start-resolving', rowId: row.id });
    expect(d.rows[0].state).toBe('resolving');
  });

  it('auto-accepts a lone confident hit', () => {
    const base = seeded();
    const [row] = base.rows;
    const d = apply(
      base,
      { type: 'start-resolving', rowId: row.id },
      { type: 'resolved', rowId: row.id, candidates: [cand({ importance: 0.71 })] },
    );
    expect(d.rows[0]).toMatchObject({ state: 'single', decision: 'accept', selectedIndex: 0 });
  });

  it('leaves an ambiguous row undecided', () => {
    const base = seeded();
    const [row] = base.rows;
    const d = draftReducer(base, {
      type: 'resolved',
      rowId: row.id,
      candidates: [cand({ name: 'Kiyomizu-dera' }), cand({ name: 'Kiyomizu', importance: 0.31 })],
    });
    expect(d.rows[0]).toMatchObject({ state: 'multiple', decision: null, selectedIndex: null });
    expect(d.rows[0].candidates).toHaveLength(2);
  });

  it('records a geocode error and lets retry clear it back to pending', () => {
    const base = seeded();
    const [row] = base.rows;
    const withError = draftReducer(base, {
      type: 'geocode-error',
      rowId: row.id,
      error: 'rate limited',
    });
    expect(withError.rows[0]).toMatchObject({ state: 'error', error: 'rate limited' });

    const retried = draftReducer(withError, { type: 'retry', rowId: row.id });
    expect(retried.rows[0]).toMatchObject({ state: 'pending', error: undefined, decision: null });
  });

  it('retype resets state and clears prior candidates', () => {
    const base = seeded();
    const [row] = base.rows;
    const resolved = draftReducer(base, {
      type: 'resolved',
      rowId: row.id,
      candidates: [cand({ importance: 0.9 })],
    });
    const retyped = draftReducer(resolved, {
      type: 'retype',
      rowId: row.id,
      raw: 'kiyomizu dera kyoto',
    });
    expect(retyped.rows[0]).toMatchObject({
      raw: 'kiyomizu dera kyoto',
      state: 'pending',
      candidates: [],
      decision: null,
    });
  });

  it('an action with an unknown rowId is a no-op', () => {
    const d = seeded();
    expect(draftReducer(d, { type: 'start-resolving', rowId: 'nope' })).toBe(d);
  });
});

describe('user decisions', () => {
  function ambiguous() {
    const d = apply(createDraft('p', 'paste'), {
      type: 'add-rows',
      text: 'kiyomizu temple',
      origin: 'line',
    });
    const [row] = d.rows;
    return draftReducer(d, {
      type: 'resolved',
      rowId: row.id,
      candidates: [cand({ name: 'Kiyomizu-dera' }), cand({ name: 'Kiyomizu', importance: 0.31 })],
    });
  }

  it('selecting a candidate is itself the decision — no separate submit', () => {
    const d = ambiguous();
    const picked = draftReducer(d, { type: 'select-candidate', rowId: d.rows[0].id, index: 1 });
    expect(picked.rows[0]).toMatchObject({ selectedIndex: 1, decision: 'accept' });
  });

  it('ignores an out-of-range candidate index', () => {
    const d = ambiguous();
    const picked = draftReducer(d, { type: 'select-candidate', rowId: d.rows[0].id, index: 9 });
    expect(picked.rows[0].decision).toBeNull();
  });

  it('the "Skip this place" radio keeps the row as keep-unresolved, not a full discard', () => {
    const d = ambiguous();
    const decided = draftReducer(d, {
      type: 'decide',
      rowId: d.rows[0].id,
      decision: 'keep-unresolved',
    });
    expect(decided.rows).toHaveLength(1);
    expect(decided.rows[0].decision).toBe('keep-unresolved');
  });

  it('remove-row fully discards the row', () => {
    const d = ambiguous();
    const removed = draftReducer(d, { type: 'remove-row', rowId: d.rows[0].id });
    expect(removed.rows).toHaveLength(0);
  });
});

describe('unresolvedCount / isReadyToCommit', () => {
  it('counts rows with no decision yet', () => {
    const d = apply(createDraft('p', 'paste'), {
      type: 'add-rows',
      text: 'A\nB',
      origin: 'line',
    });
    expect(unresolvedCount(d)).toBe(2);
    expect(isReadyToCommit(d)).toBe(false);
  });

  it('is ready once every row has a decision', () => {
    const d = apply(createDraft('p', 'paste'), { type: 'add-rows', text: 'A', origin: 'line' });
    const decided = draftReducer(d, { type: 'decide', rowId: d.rows[0].id, decision: 'skip' });
    expect(unresolvedCount(decided)).toBe(0);
    expect(isReadyToCommit(decided)).toBe(true);
  });

  it('an empty draft is never ready to commit', () => {
    expect(isReadyToCommit(createDraft('p', 'paste'))).toBe(false);
  });
});

describe('toPlaces', () => {
  it('builds a confirmed Place from an accepted candidate', () => {
    const d = apply(
      createDraft('p', 'paste'),
      { type: 'add-rows', text: 'kiyomizu temple', origin: 'line' },
    );
    const [row] = d.rows;
    const resolved = draftReducer(d, {
      type: 'resolved',
      rowId: row.id,
      candidates: [cand({ importance: 0.9 })],
    });

    const places = toPlaces(resolved, '2026-08-01T00:00:00.000Z');
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({
      raw: 'kiyomizu temple',
      status: 'confirmed',
      name: 'Kiyomizu-dera',
      lat: 34.9949,
      lon: 135.785,
      wikipedia: 'en:Kiyomizu-dera',
      origin: 'line',
    });
  });

  it('builds an unresolved Place with no coordinates for keep-unresolved', () => {
    const d = apply(createDraft('p', 'paste'), { type: 'add-rows', text: 'a ramen place', origin: 'line' });
    const decided = draftReducer(d, {
      type: 'decide',
      rowId: d.rows[0].id,
      decision: 'keep-unresolved',
    });

    const places = toPlaces(decided);
    expect(places).toEqual([
      expect.objectContaining({ status: 'unresolved', name: 'a ramen place', lat: null, lon: null }),
    ]);
  });

  it('drops skipped and undecided rows entirely', () => {
    const d = apply(createDraft('p', 'paste'), { type: 'add-rows', text: 'A\nB', origin: 'line' });
    const skipped = draftReducer(d, { type: 'decide', rowId: d.rows[0].id, decision: 'skip' });
    expect(toPlaces(skipped)).toEqual([]);
  });

  it('gives every place a distinct id', () => {
    const d = apply(createDraft('p', 'paste'), { type: 'add-rows', text: 'A\nB', origin: 'line' });
    const decided = d.rows.reduce(
      (acc, r) => draftReducer(acc, { type: 'decide', rowId: r.id, decision: 'keep-unresolved' }),
      d,
    );
    const places = toPlaces(decided);
    expect(new Set(places.map((p) => p.id)).size).toBe(2);
  });
});
