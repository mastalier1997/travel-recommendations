/**
 * Lowercase, collapse whitespace, trim. Used for two things that must never drift
 * apart: the geo_cache key input, and the "have I already resolved this raw string?"
 * lookup behind SC 3.3.7 Redundant Entry.
 */
export function normalizeQuery(q: string): string {
  return q.toLowerCase().replace(/\s+/g, ' ').trim();
}
