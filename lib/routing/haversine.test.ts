import { describe, it, expect } from 'vitest';
import { haversineMatrix } from './haversine';

describe('haversineMatrix', () => {
  it('has a zero diagonal', () => {
    const m = haversineMatrix([
      { lat: 0, lon: 0 },
      { lat: 1, lon: 1 },
    ]);
    expect(m[0][0]).toBe(0);
    expect(m[1][1]).toBe(0);
  });

  it('is symmetric', () => {
    const m = haversineMatrix([
      { lat: 34.9671, lon: 135.7727 },
      { lat: 35.0051, lon: 135.7645 },
      { lat: 34.6687, lon: 135.5015 },
    ]);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) expect(m[i][j]).toBeCloseTo(m[j][i], 6);
    }
  });

  it('is close to the well-known ~111.2km per degree of latitude at the equator', () => {
    const m = haversineMatrix([
      { lat: 0, lon: 0 },
      { lat: 1, lon: 0 },
    ]);
    expect(m[0][1]).toBeGreaterThan(111_000);
    expect(m[0][1]).toBeLessThan(111_400);
  });
});
