import { AUTO_ACCEPT_IMPORTANCE, PLACE_CLASSES, type Candidate } from '@/lib/types';

export type Classification =
  | { state: 'single'; candidates: Candidate[]; selectedIndex: 0; decision: 'accept' }
  | { state: 'multiple'; candidates: Candidate[]; selectedIndex: null; decision: null }
  | { state: 'none'; candidates: Candidate[]; selectedIndex: null; decision: null };

const PLACE_CLASS_SET = new Set<string>(PLACE_CLASSES);

/**
 * Turns a raw geocode response into a row outcome. `filterToPlaceClasses` is only
 * true for prose-scanned rows: line-by-line input is something the user typed on
 * purpose and is never second-guessed by OSM class. Prose extraction is loose by
 * design (scan-prose.ts) — this is where "Monday" actually gets discarded, by
 * geocoding to nothing usable rather than by guessing from the text itself.
 */
export function classify(candidates: Candidate[], filterToPlaceClasses: boolean): Classification {
  const usable = filterToPlaceClasses
    ? candidates.filter((c) => PLACE_CLASS_SET.has(c.class))
    : candidates;

  if (usable.length === 0) {
    return { state: 'none', candidates: usable, selectedIndex: null, decision: null };
  }
  // A lone confident hit is auto-accepted — that is what keeps a 50-row confirm
  // screen a review rather than data entry. Still shown with a "change" affordance.
  if (usable.length === 1 && usable[0].importance >= AUTO_ACCEPT_IMPORTANCE) {
    return { state: 'single', candidates: usable, selectedIndex: 0, decision: 'accept' };
  }
  return { state: 'multiple', candidates: usable, selectedIndex: null, decision: null };
}
