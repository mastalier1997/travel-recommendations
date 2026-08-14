import type { Candidate } from '@/lib/types';
import { candidateKey } from './candidateKey';

export const PRIOR_CHOICE_PREFIX = 'wanderlist:resolved:';

/** SC 3.3.7 Redundant Entry: localStorage key a prior choice for this raw text is stored under. */
export function priorChoiceStorageKey(normalizedRaw: string): string {
  return `${PRIOR_CHOICE_PREFIX}${normalizedRaw}`;
}

/**
 * Pure lookup — the caller supplies whatever it read from localStorage as `storedKey`,
 * so this is testable without a DOM. Returns null when there is nothing stored, or the
 * stored candidate no longer appears in this response (e.g. it dropped out upstream).
 */
export function pickPriorCandidateIndex(candidates: Candidate[], storedKey: string | null): number | null {
  if (!storedKey) return null;
  const index = candidates.findIndex((c) => candidateKey(c) === storedKey);
  return index === -1 ? null : index;
}
