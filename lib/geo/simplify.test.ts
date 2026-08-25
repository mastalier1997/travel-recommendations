import { describe, it, expect } from 'vitest';
import { simplifyLine, simplifyToMaxPoints, type Point } from './simplify';

describe('simplifyLine', () => {
  it('keeps short lines unchanged', () => {
    const points: Point[] = [
      [0, 0],
      [1, 1],
    ];
    expect(simplifyLine(points, 0.5)).toEqual(points);
  });

  it('always keeps the first and last point', () => {
    const points: Point[] = [
      [0, 0],
      [1, 0.001],
      [2, -0.001],
      [3, 0],
    ];
    const result = simplifyLine(points, 1);
    expect(result[0]).toEqual(points[0]);
    expect(result[result.length - 1]).toEqual(points[points.length - 1]);
  });

  it('drops points that sit within tolerance of a straight chord', () => {
    // A near-straight line — the middle points barely deviate.
    const points: Point[] = [
      [0, 0],
      [1, 0.0001],
      [2, -0.0001],
      [3, 0.0001],
      [4, 0],
    ];
    expect(simplifyLine(points, 0.01)).toEqual([points[0], points[4]]);
  });

  it('keeps a sharp corner that exceeds tolerance', () => {
    const points: Point[] = [
      [0, 0],
      [1, 1], // sharp spike well off the 0,0 -> 2,0 chord
      [2, 0],
    ];
    expect(simplifyLine(points, 0.1)).toEqual(points);
  });
});

describe('simplifyToMaxPoints', () => {
  it('returns the input unchanged when already under the cap', () => {
    const points: Point[] = [
      [0, 0],
      [1, 0],
      [2, 0],
    ];
    expect(simplifyToMaxPoints(points, 10)).toEqual(points);
  });

  it('reduces a dense near-straight line to at most maxPoints', () => {
    const points: Point[] = Array.from({ length: 500 }, (_, i) => [i * 0.01, Math.sin(i / 40) * 0.02]);
    const result = simplifyToMaxPoints(points, 50);
    expect(result.length).toBeLessThanOrEqual(50);
    expect(result[0]).toEqual(points[0]);
    expect(result[result.length - 1]).toEqual(points[points.length - 1]);
  });
});
