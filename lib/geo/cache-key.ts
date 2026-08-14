import { createHash } from 'node:crypto';
import { normalizeQuery } from './normalize';
import type { GeoProvider } from './provider';

const TTL_HIT_MS = 60 * 24 * 60 * 60 * 1000;
/** Shorter TTL for a zero-result query — a typo fixed on retype shouldn't stay
 *  cached-empty for two months. */
const TTL_MISS_MS = 7 * 24 * 60 * 60 * 1000;

export function cacheKey(
  provider: GeoProvider,
  query: string,
  near?: { lat: number; lon: number },
): string {
  const normQ = normalizeQuery(query);
  // Rounded to ~1km so a slightly different map center still hits the same row —
  // exact-coordinate bias keys would fragment the cache for no benefit.
  const biasKey = near ? `${near.lat.toFixed(2)},${near.lon.toFixed(2)}` : '';
  return createHash('sha1').update(`${provider}|${normQ}|${biasKey}`).digest('hex');
}

/** True once a cached row has aged past its TTL — shorter for an empty result. */
export function isExpired(fetchedAt: string, candidateCount: number, now = Date.now()): boolean {
  const ttl = candidateCount === 0 ? TTL_MISS_MS : TTL_HIT_MS;
  return now - new Date(fetchedAt).getTime() > ttl;
}
