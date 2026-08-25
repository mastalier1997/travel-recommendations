import { describe, it, expect } from 'vitest';
import { metersPerPixel, scaleBar } from './scale';

describe('metersPerPixel', () => {
  it('matches the standard Web Mercator constant at the equator, zoom 0', () => {
    expect(metersPerPixel(0, 0)).toBeCloseTo(156_543.03, 0);
  });

  it('halves for every zoom level increment', () => {
    const z5 = metersPerPixel(5, 0);
    const z6 = metersPerPixel(6, 0);
    expect(z6).toBeCloseTo(z5 / 2, 5);
  });

  it('shrinks toward the poles (cosine of latitude)', () => {
    expect(metersPerPixel(5, 60)).toBeLessThan(metersPerPixel(5, 0));
  });
});

describe('scaleBar', () => {
  it('picks a round 1/2/5 number of meters that fits the pixel budget', () => {
    const { meters, widthPx } = scaleBar(5, 0, 100);
    const leadingDigit = Number(meters.toString().replace(/0+$/, '')[0]);
    expect([1, 2, 5]).toContain(leadingDigit);
    expect(widthPx).toBeLessThanOrEqual(100);
    expect(widthPx).toBeGreaterThan(0);
  });

  it('formats sub-km distances in meters, km otherwise', () => {
    expect(scaleBar(15, 0, 100).label).toMatch(/ m$/);
    expect(scaleBar(2, 0, 100).label).toMatch(/ km$/);
  });
});
