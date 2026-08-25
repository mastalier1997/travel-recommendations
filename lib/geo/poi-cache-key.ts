import { createHash } from 'node:crypto';
import type { Point } from './simplify';

/** Shorter than geo_cache's 60d — POIs near a route change (new business, closed
 * one) more often than a place's own name/coordinates do. */
export const POI_TTL_HIT_MS = 7 * 24 * 60 * 60 * 1000;
/** Same asymmetry as lib/geo/cache-key.ts's TTL_MISS_MS: an empty corridor might
 * just have been queried before Overpass's data caught up, so don't let a
 * zero-result search stay cached-empty as long as a real hit does. */
export const POI_TTL_MISS_MS = 1 * 24 * 60 * 60 * 1000;

/** Rounds each corridor point to ~1km so a slightly different anchor stop along
 * the same stretch of route still hits the same cached row — same trick as
 * lib/geo/cache-key.ts's bias-key rounding. */
export function poiCacheKey(corridor: Point[], radiusM: number): string {
  const rounded = corridor.map(([lon, lat]) => `${lon.toFixed(2)},${lat.toFixed(2)}`).join('|');
  return createHash('sha1').update(`overpass|${rounded}|${radiusM}`).digest('hex');
}

export function isPoiCacheExpired(fetchedAt: string, poiCount: number, now = Date.now()): boolean {
  const ttl = poiCount === 0 ? POI_TTL_MISS_MS : POI_TTL_HIT_MS;
  return now - new Date(fetchedAt).getTime() > ttl;
}
