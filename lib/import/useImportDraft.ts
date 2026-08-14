'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DraftRow, ImportDraft } from '@/lib/types';
import {
  createDraft,
  draftReducer,
  isReadyToCommit,
  toPlaces,
  unresolvedCount,
  type DraftAction,
} from './draft';
import { resolveAll, fetchGeocoder, type Geocoder } from './resolve';
import { normalizeQuery } from '@/lib/geo/normalize';
import { candidateKey } from './candidateKey';
import { pickPriorCandidateIndex, priorChoiceStorageKey } from './priorChoice';

const DRAFT_KEY_PREFIX = 'wanderlist:draft:';

function loadOrCreate(planId: string): ImportDraft {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(DRAFT_KEY_PREFIX + planId);
      if (raw) return JSON.parse(raw) as ImportDraft;
    } catch {
      // Corrupt localStorage entry — start fresh rather than crash the import screen.
    }
  }
  return createDraft(planId, 'paste');
}

function applyPriorChoice(draft: ImportDraft, rowId: string): ImportDraft {
  const row = draft.rows.find((r) => r.id === rowId);
  if (!row || row.decision !== null) return draft; // already decided (e.g. auto-accepted)
  if (row.state !== 'single' && row.state !== 'multiple') return draft;

  const stored = localStorage.getItem(priorChoiceStorageKey(normalizeQuery(row.raw)));
  const index = pickPriorCandidateIndex(row.candidates, stored);
  if (index === null) return draft;
  return draftReducer(draft, { type: 'select-candidate', rowId, index });
}

/**
 * Owns the draft state machine (lib/import/draft.ts), its localStorage persistence
 * under `wanderlist:draft:{planId}`, and the concurrency-1 resolve-loop orchestration
 * (lib/import/resolve.ts). Nothing here is unit-tested directly — the pieces it wires
 * together (draftReducer, resolveAll, pickPriorCandidateIndex) already are.
 */
export function useImportDraft(planId: string, geocode: Geocoder = fetchGeocoder) {
  const [draft, setDraft] = useState<ImportDraft>(() => loadOrCreate(planId));

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY_PREFIX + planId, JSON.stringify(draft));
  }, [draft, planId]);

  const dispatch = useCallback((action: DraftAction) => {
    setDraft((cur) => {
      const next = draftReducer(cur, action);
      return action.type === 'resolved' ? applyPriorChoice(next, action.rowId) : next;
    });
  }, []);

  const kickResolve = useCallback(
    (next: ImportDraft) => {
      const pending = next.rows.filter((r) => r.state === 'pending');
      if (pending.length) void resolveAll(pending, dispatch, geocode);
    },
    [dispatch, geocode],
  );

  const addRows = useCallback(
    (text: string, origin: DraftRow['origin']) => {
      const next = draftReducer(draft, { type: 'add-rows', text, origin });
      setDraft(next);
      kickResolve(next);
    },
    [draft, kickResolve],
  );

  const retry = useCallback(
    (rowId: string) => {
      const next = draftReducer(draft, { type: 'retry', rowId });
      setDraft(next);
      kickResolve(next);
    },
    [draft, kickResolve],
  );

  const retype = useCallback(
    (rowId: string, raw: string) => {
      const next = draftReducer(draft, { type: 'retype', rowId, raw });
      setDraft(next);
      kickResolve(next);
    },
    [draft, kickResolve],
  );

  const selectCandidate = useCallback(
    (rowId: string, index: number) => {
      const row = draft.rows.find((r) => r.id === rowId);
      const candidate = row?.candidates[index];
      if (row && candidate) {
        localStorage.setItem(priorChoiceStorageKey(normalizeQuery(row.raw)), candidateKey(candidate));
      }
      dispatch({ type: 'select-candidate', rowId, index });
    },
    [dispatch, draft.rows],
  );

  const decide = useCallback(
    (rowId: string, decision: 'skip' | 'keep-unresolved') => dispatch({ type: 'decide', rowId, decision }),
    [dispatch],
  );

  const removeRow = useCallback((rowId: string) => dispatch({ type: 'remove-row', rowId }), [dispatch]);

  const clear = useCallback(() => localStorage.removeItem(DRAFT_KEY_PREFIX + planId), [planId]);

  return {
    draft,
    addRows,
    retry,
    retype,
    selectCandidate,
    decide,
    removeRow,
    clear,
    unresolvedCount: unresolvedCount(draft),
    readyToCommit: isReadyToCommit(draft),
    toPlaces: (now?: string) => toPlaces(draft, now),
  };
}
