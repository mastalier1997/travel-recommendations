import { describe, it, expect } from 'vitest';
import { nearestDistanceM } from './outlier';

describe('nearestDistanceM', () => {
  it('returns null with no other points to compare against', () => {
    expect(nearestDistanceM({ lat: 35, lon: 135 }, [])).toBeNull();
  });

  it('returns the distance to the closest of several points, not the farthest', () => {
    const point = { lat: 0, lon: 0 };
    const near = { lat: 0.01, lon: 0 }; // ~1.1 km
    const far = { lat: 10, lon: 10 }; // very far
    const d = nearestDistanceM(point, [far, near]);
    expect(d).toBeCloseTo(nearestDistanceM(point, [near]) as number, 0);
  });

  it('is 0 for a point identical to one of the others', () => {
    const point = { lat: 35, lon: 135 };
    expect(nearestDistanceM(point, [point])).toBe(0);
  });
});
