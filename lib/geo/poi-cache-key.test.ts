import { describe, it, expect } from 'vitest';
import { poiCacheKey, isPoiCacheExpired, POI_TTL_HIT_MS, POI_TTL_MISS_MS } from './poi-cache-key';

describe('poiCacheKey', () => {
  it('is stable for the same corridor and radius', () => {
    const corridor: [number, number][] = [
      [13.405, 52.52],
      [13.41, 52.525],
    ];
    expect(poiCacheKey(corridor, 5000)).toBe(poiCacheKey(corridor, 5000));
  });

  it('rounds points so a ~sub-km jitter shares a cache row', () => {
    const a: [number, number][] = [[13.406, 52.521]];
    const b: [number, number][] = [[13.4055, 52.5212]];
    expect(poiCacheKey(a, 5000)).toBe(poiCacheKey(b, 5000));
  });

  it('differs when the radius differs', () => {
    const corridor: [number, number][] = [[13.4, 52.5]];
    expect(poiCacheKey(corridor, 5000)).not.toBe(poiCacheKey(corridor, 10000));
  });

  it('differs for a meaningfully different corridor', () => {
    expect(poiCacheKey([[13.4, 52.5]], 5000)).not.toBe(poiCacheKey([[10.4, 48.5]], 5000));
  });
});

describe('isPoiCacheExpired', () => {
  const now = Date.parse('2026-01-08T00:00:00.000Z');

  it('a hit stays fresh well within the 7-day TTL', () => {
    const fetchedAt = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(isPoiCacheExpired(fetchedAt, 3, now)).toBe(false);
  });

  it('a hit expires past the 7-day TTL', () => {
    const fetchedAt = new Date(now - POI_TTL_HIT_MS - 1).toISOString();
    expect(isPoiCacheExpired(fetchedAt, 3, now)).toBe(true);
  });

  it('a zero-result row expires on the shorter miss TTL, well before a hit would', () => {
    const fetchedAt = new Date(now - POI_TTL_MISS_MS - 1).toISOString();
    expect(isPoiCacheExpired(fetchedAt, 0, now)).toBe(true);
    expect(isPoiCacheExpired(fetchedAt, 3, now)).toBe(false); // same age, but a hit
  });
});
