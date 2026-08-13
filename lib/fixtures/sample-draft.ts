import type { Candidate, DraftRow, ImportDraft } from '@/lib/types';
import { AUTO_ACCEPT_IMPORTANCE } from '@/lib/types';
import recorded from './geocode-responses.json';

/**
 * The M3 "2 places need review" screen, as data. Track I renders this directly;
 * Track C's reducer should be able to produce it from RAW_TEXT + the recorded responses.
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

  if (candidates.length === 0) {
    return { id, raw, state: 'none', candidates, selectedIndex: null, decision: null };
  }
  // A lone confident hit is auto-accepted — that is what keeps a 50-row confirm
  // screen a review rather than data entry.
  if (candidates.length === 1 && candidates[0].importance >= AUTO_ACCEPT_IMPORTANCE) {
    return { id, raw, state: 'single', candidates, selectedIndex: 0, decision: 'accept' };
  }
  return { id, raw, state: 'multiple', candidates, selectedIndex: null, decision: null };
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
