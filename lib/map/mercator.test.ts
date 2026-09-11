import { describe, it, expect } from 'vitest';
import { projectPx, unwrapDx, pixelDistance, lonLatCentroid } from './mercator';

describe('projectPx', () => {
  it('places (0, 0) at the center of the world at any zoom', () => {
    const { x, y } = projectPx(0, 0, 4);
    const worldSize = 256 * 2 ** 4;
    expect(x).toBeCloseTo(worldSize / 2, 5);
    expect(y).toBeCloseTo(worldSize / 2, 5);
  });

  it('increasing longitude increases x', () => {
    expect(projectPx(10, 0, 5).x).toBeGreaterThan(projectPx(0, 0, 5).x);
  });

  it('increasing latitude decreases y (north is up)', () => {
    expect(projectPx(0, 10, 5).y).toBeLessThan(projectPx(0, 0, 5).y);
  });
});

describe('unwrapDx', () => {
  it('leaves a delta within half the world size untouched', () => {
    expect(unwrapDx(100, 1000)).toBe(100);
  });

  it('wraps a delta past half the world size the short way round', () => {
    expect(unwrapDx(900, 1000)).toBe(-100);
    expect(unwrapDx(-900, 1000)).toBe(100);
  });
});

describe('pixelDistance', () => {
  it('is zero for the same point', () => {
    expect(pixelDistance({ lon: 101.7, lat: 3.1 }, { lon: 101.7, lat: 3.1 }, 8)).toBe(0);
  });

  it('doubles for every zoom level increment (fixed lon/lat delta)', () => {
    const a = { lon: 0, lat: 0 };
    const b = { lon: 1, lat: 0 };
    const d5 = pixelDistance(a, b, 5);
    const d6 = pixelDistance(a, b, 6);
    expect(d6).toBeCloseTo(d5 * 2, 5);
  });

  it('treats two points just across the antimeridian as close, not a world apart', () => {
    const near = pixelDistance({ lon: 179.9, lat: 0 }, { lon: -179.9, lat: 0 }, 5);
    const worldSize = 256 * 2 ** 5;
    expect(near).toBeLessThan(worldSize * 0.01);
  });
});

describe('lonLatCentroid', () => {
  it('averages ordinary points directly', () => {
    const c = lonLatCentroid([
      { lon: 100, lat: 0 },
      { lon: 110, lat: 10 },
    ]);
    expect(c.lon).toBeCloseTo(105, 5);
    expect(c.lat).toBeCloseTo(5, 5);
  });

  it('averages points straddling the antimeridian without landing on the wrong side of the globe', () => {
    const c = lonLatCentroid([
      { lon: 179, lat: 0 },
      { lon: -179, lat: 0 },
    ]);
    expect(Math.abs(c.lon)).toBeGreaterThan(179);
  });
});
