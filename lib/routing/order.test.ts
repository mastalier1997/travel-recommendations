import { describe, it, expect } from 'vitest';
import { orderHash, isRouteStale } from './order';
import { SAMPLE_PLAN } from '@/lib/fixtures/sample-plan';
import type { Route } from '@/lib/types';

const p = (...ids: string[]) => ids.map((id) => ({ id }));

describe('orderHash', () => {
  it('is stable for the same order', () => {
    expect(orderHash(p('a', 'b', 'c'), 'driving', false)).toBe(
      orderHash(p('a', 'b', 'c'), 'driving', false),
    );
  });

  it('changes when the order changes', () => {
    expect(orderHash(p('a', 'b', 'c'), 'driving', false)).not.toBe(
      orderHash(p('a', 'c', 'b'), 'driving', false),
    );
  });

  it('changes with mode and roundTrip', () => {
    const base = orderHash(p('a', 'b'), 'driving', false);
    expect(orderHash(p('a', 'b'), 'walking', false)).not.toBe(base);
    expect(orderHash(p('a', 'b'), 'driving', true)).not.toBe(base);
  });

  it('does not confuse id boundaries', () => {
    // "a,bc" vs "ab,c" must differ — a naive concat would collide.
    expect(orderHash(p('a', 'bc'), 'driving', false)).not.toBe(
      orderHash(p('ab', 'c'), 'driving', false),
    );
  });
});

describe('isRouteStale', () => {
  it('is false for the fixture as shipped', () => {
    expect(isRouteStale(SAMPLE_PLAN.places, SAMPLE_PLAN.route)).toBe(false);
  });

  it('is false when there is no route', () => {
    expect(isRouteStale(SAMPLE_PLAN.places, null)).toBe(false);
  });

  it('is true after a reorder', () => {
    const swapped = [SAMPLE_PLAN.places[1], SAMPLE_PLAN.places[0], ...SAMPLE_PLAN.places.slice(2)];
    expect(isRouteStale(swapped, SAMPLE_PLAN.route)).toBe(true);
  });

  it('is true after a removal', () => {
    expect(isRouteStale(SAMPLE_PLAN.places.slice(1), SAMPLE_PLAN.route)).toBe(true);
  });

  it('is true when the mode changed under it', () => {
    const walked = { ...(SAMPLE_PLAN.route as Route), mode: 'walking' as const };
    expect(isRouteStale(SAMPLE_PLAN.places, walked)).toBe(true);
  });
});
