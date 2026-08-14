import type { Candidate, DraftDecision, DraftRow, ImportDraft, Place } from '@/lib/types';
import { MAX_DRAFT_ROWS } from '@/lib/types';
import { normalizeQuery } from '@/lib/geo/normalize';
import { splitLines } from './split-lines';
import { scanProse } from './scan-prose';
import { classify } from './classify';

/**
 * The import state machine, as a pure reducer. Track I drives it: dispatch
 * `add-rows` when text arrives, `start-resolving`/`resolved`/`geocode-error` around
 * each fetch to /api/geocode (client concurrency 1 — see PLAN.md), and
 * `select-candidate`/`decide`/`retype` from the M3/M4 UI. Nothing in here performs
 * network I/O, so it is testable without a server and without fake timers.
 */

export function createDraft(planId: string, sourceKind: ImportDraft['sourceKind']): ImportDraft {
  return { planId, sourceKind, rawText: '', rows: [], createdAt: new Date().toISOString() };
}

export type DraftAction =
  | { type: 'add-rows'; text: string; origin: DraftRow['origin'] }
  | { type: 'start-resolving'; rowId: string }
  | { type: 'resolved'; rowId: string; candidates: Candidate[] }
  | { type: 'geocode-error'; rowId: string; error: string }
  | { type: 'retry'; rowId: string }
  | { type: 'retype'; rowId: string; raw: string }
  | { type: 'select-candidate'; rowId: string; index: number }
  | { type: 'decide'; rowId: string; decision: Extract<DraftDecision, 'skip' | 'keep-unresolved'> }
  | { type: 'remove-row'; rowId: string };

export function draftReducer(draft: ImportDraft, action: DraftAction): ImportDraft {
  switch (action.type) {
    case 'add-rows':
      return addRows(draft, action.text, action.origin);

    case 'start-resolving':
      return updateRow(draft, action.rowId, (row) => ({ ...row, state: 'resolving', error: undefined }));

    case 'resolved':
      return updateRow(draft, action.rowId, (row) => {
        const c = classify(action.candidates, row.origin === 'prose');
        return { ...row, ...c, error: undefined };
      });

    case 'geocode-error':
      return updateRow(draft, action.rowId, (row) => ({ ...row, state: 'error', error: action.error }));

    case 'retry':
      return updateRow(draft, action.rowId, (row) => ({
        ...row,
        state: 'pending',
        error: undefined,
        candidates: [],
        selectedIndex: null,
        decision: null,
      }));

    case 'retype':
      return updateRow(draft, action.rowId, (row) => ({
        ...row,
        raw: action.raw,
        state: 'pending',
        error: undefined,
        candidates: [],
        selectedIndex: null,
        decision: null,
      }));

    case 'select-candidate':
      return updateRow(draft, action.rowId, (row) =>
        row.candidates[action.index]
          ? { ...row, selectedIndex: action.index, decision: 'accept' }
          : row,
      );

    // The "Skip this place" radio in the confirm UI keeps the raw text with no pin —
    // that is 'keep-unresolved', not a full discard. A row is only ever fully
    // dropped by removing it outright (remove-row), which the UI does not currently
    // expose from the confirm screen but the reducer supports for completeness.
    case 'decide':
      return updateRow(draft, action.rowId, (row) => ({ ...row, decision: action.decision }));

    case 'remove-row':
      return { ...draft, rows: draft.rows.filter((r) => r.id !== action.rowId) };

    default:
      return draft;
  }
}

function updateRow(draft: ImportDraft, rowId: string, fn: (row: DraftRow) => DraftRow): ImportDraft {
  const index = draft.rows.findIndex((r) => r.id === rowId);
  if (index === -1) return draft;
  const rows = draft.rows.slice();
  rows[index] = fn(rows[index]);
  return { ...draft, rows };
}

function addRows(draft: ImportDraft, text: string, origin: DraftRow['origin']): ImportDraft {
  const raws = origin === 'prose' ? scanProse(text) : splitLines(text);

  // Never re-ask for something already in this draft — SC 3.3.7 Redundant Entry,
  // and it also protects a prose scan from duplicating rows a line-split already
  // produced.
  const seen = new Set(draft.rows.map((r) => normalizeQuery(r.raw)));
  const fresh: DraftRow[] = [];
  for (const raw of raws) {
    const key = normalizeQuery(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    fresh.push({
      id: crypto.randomUUID(),
      raw,
      state: 'pending',
      candidates: [],
      selectedIndex: null,
      decision: null,
      origin,
    });
  }

  const rows = [...draft.rows, ...fresh].slice(0, MAX_DRAFT_ROWS);
  const rawText = draft.rawText ? `${draft.rawText}\n${text}` : text;
  return { ...draft, rows, rawText };
}

/** Rows the user still has to decide on — the sticky "Confirm N places" bar's count. */
export function unresolvedCount(draft: ImportDraft): number {
  return draft.rows.filter((r) => r.decision === null).length;
}

/** True once every row has a decision — the point the M3 screen's Confirm button lights up. */
export function isReadyToCommit(draft: ImportDraft): boolean {
  return draft.rows.length > 0 && unresolvedCount(draft) === 0;
}

/**
 * The committing step. Descriptions are deliberately left null — they are fetched
 * after commit (Track E), not on the import path, since import is already the slow
 * step. Rows decided 'skip' are dropped; everything else the caller has already
 * validated is decided reaches here as either 'accept' or 'keep-unresolved'.
 */
export function toPlaces(draft: ImportDraft, now: string = new Date().toISOString()): Place[] {
  const places: Place[] = [];

  for (const row of draft.rows) {
    if (row.decision === 'accept' && row.selectedIndex !== null) {
      const c = row.candidates[row.selectedIndex];
      if (!c) continue;
      places.push({
        id: crypto.randomUUID(),
        raw: row.raw,
        status: 'confirmed',
        name: c.name,
        lat: c.lat,
        lon: c.lon,
        address: c.address,
        osm: c.osm,
        wikidata: c.wikidata,
        wikipedia: c.wikipedia,
        description: null,
        notes: null,
        origin: row.origin,
        addedAt: now,
      });
    } else if (row.decision === 'keep-unresolved') {
      places.push({
        id: crypto.randomUUID(),
        raw: row.raw,
        status: 'unresolved',
        name: row.raw,
        lat: null,
        lon: null,
        address: null,
        osm: null,
        wikidata: null,
        wikipedia: null,
        description: null,
        notes: null,
        origin: row.origin,
        addedAt: now,
      });
    }
    // decision === 'skip', or still null: not committed.
  }

  return places;
}
