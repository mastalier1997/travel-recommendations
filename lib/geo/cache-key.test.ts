import { describe, it, expect } from 'vitest';
import { cacheKey, isExpired } from './cache-key';

describe('cacheKey', () => {
  it('is stable for the same inputs', () => {
    expect(cacheKey('nominatim', 'Fushimi Inari')).toBe(cacheKey('nominatim', 'Fushimi Inari'));
  });

  it('is case- and whitespace-insensitive, like the redundant-entry lookup', () => {
    expect(cacheKey('nominatim', '  fushimi   inari  ')).toBe(cacheKey('nominatim', 'Fushimi Inari'));
  });

  it('differs by provider — switching GEOCODER must not serve cross-provider results', () => {
    expect(cacheKey('nominatim', 'Fushimi Inari')).not.toBe(cacheKey('maptiler', 'Fushimi Inari'));
  });

  it('differs by query', () => {
    expect(cacheKey('nominatim', 'A')).not.toBe(cacheKey('nominatim', 'B'));
  });

  it('differs when a bias coordinate is present vs absent', () => {
    const near = { lat: 34.9671, lon: 135.7727 };
    expect(cacheKey('nominatim', 'temple', near)).not.toBe(cacheKey('nominatim', 'temple'));
  });

  it('rounds bias coordinates so nearby-but-not-identical map centers share a cache row', () => {
    expect(cacheKey('nominatim', 'temple', { lat: 34.9671, lon: 135.7727 })).toBe(
      cacheKey('nominatim', 'temple', { lat: 34.9673, lon: 135.7729 }),
    );
  });

  it('is a 40-character hex sha1 digest', () => {
    expect(cacheKey('nominatim', 'Fushimi Inari')).toMatch(/^[0-9a-f]{40}$/);
  });
});

describe('isExpired', () => {
  const DAY = 24 * 60 * 60 * 1000;

  it('is not expired when fresh', () => {
    expect(isExpired(new Date(0).toISOString(), 3, 10)).toBe(false);
  });

  it('uses the 60-day TTL for a hit', () => {
    const fetchedAt = new Date(0).toISOString();
    expect(isExpired(fetchedAt, 3, 59 * DAY)).toBe(false);
    expect(isExpired(fetchedAt, 3, 61 * DAY)).toBe(true);
  });

  it('uses the shorter 7-day TTL for a zero-result row', () => {
    const fetchedAt = new Date(0).toISOString();
    expect(isExpired(fetchedAt, 0, 6 * DAY)).toBe(false);
    expect(isExpired(fetchedAt, 0, 8 * DAY)).toBe(true);
  });
});
