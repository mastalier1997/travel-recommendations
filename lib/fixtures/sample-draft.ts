import type { Candidate, DraftRow, ImportDraft } from '@/lib/types';
import { classify } from '@/lib/import/classify';
import recorded from './geocode-responses.json';

/**
 * The M3 "2 places need review" screen, as data. Track I renders this directly.
 * Rows go through the same lib/import/classify.ts logic the real draft reducer
 * uses, so this fixture can never drift from what draftReducer would actually
 * produce for the same recorded geocode responses.
 */

const RESPONSES = recorded as unknown as Record<string, { candidates: Candidate[] }>;

export const RAW_TEXT = [
  'Fushimi Inari',
  'Nishiki Market',
  'kiyomizu temple',
  'teamlab',
  'that ramen place near the station',
].join('\n');

function row(id: string, raw: string): DraftRow {
  const candidates = RESPONSES[raw.toLowerCase()]?.candidates ?? [];
  return { id, raw, origin: 'line', ...classify(candidates, false) };
}

export const SAMPLE_DRAFT: ImportDraft = {
  planId: 'plan_japan_spring_2026',
  sourceKind: 'paste',
  rawText: RAW_TEXT,
  rows: [
    row('dr_1', 'Fushimi Inari'),
    row('dr_2', 'Nishiki Market'),
    row('dr_3', 'kiyomizu temple'),
    row('dr_4', 'teamlab'),
    row('dr_5', 'that ramen place near the station'),
  ],
  createdAt: '2026-08-01T08:55:00.000Z',
};

/** Rows the user still has to decide on — the sticky bar's count. */
export const unresolvedCount = (d: ImportDraft) =>
  d.rows.filter((r) => r.decision === null).length;
