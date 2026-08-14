import { describe, it, expect } from 'vitest';
import type { Plan } from '@/lib/types';
import { MAX_STOPS_PER_ROUTE } from '@/lib/types';
import { isRouteStale } from '@/lib/routing/order';
import { SAMPLE_PLAN } from './sample-plan';
import { SINGLE_AREA_PLAN } from './single-area-plan';
import { MULTI_COUNTRY_PLAN } from './multi-country-plan';

/**
 * Invariants every fixture plan must satisfy, run once per plan rather than
 * per-place. The one most likely to actually break something (a stale
 * orderHash left over from copy-pasting another fixture) is `isRouteStale`.
 */

const PLANS: [string, Plan][] = [
  ['SAMPLE_PLAN', SAMPLE_PLAN],
  ['SINGLE_AREA_PLAN', SINGLE_AREA_PLAN],
  ['MULTI_COUNTRY_PLAN', MULTI_COUNTRY_PLAN],
];

describe.each(PLANS)('%s', (_name, plan) => {
  it(`has at most ${MAX_STOPS_PER_ROUTE} places`, () => {
    expect(plan.places.length).toBeLessThanOrEqual(MAX_STOPS_PER_ROUTE);
  });

  it('gives every confirmed place non-null coordinates', () => {
    for (const p of plan.places) {
      if (p.status === 'confirmed') {
        expect(p.lat).not.toBeNull();
        expect(p.lon).not.toBeNull();
      }
    }
  });

  it('has unique place ids', () => {
    const ids = plan.places.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is not stale against its own places', () => {
    if (!plan.route) return;
    expect(isRouteStale(plan.places, plan.route)).toBe(false);
  });

  it("chains legs through the places array in order", () => {
    if (!plan.route) return;
    expect(plan.route.legs.length).toBe(plan.places.length - 1);
    plan.route.legs.forEach((leg, i) => {
      expect(leg.fromId).toBe(plan.places[i].id);
      expect(leg.toId).toBe(plan.places[i + 1].id);
    });
  });

  it('starts and ends its geometry at the first and last place', () => {
    if (!plan.route) return;
    const coords = plan.route.geometry.coordinates;
    const first = plan.places[0];
    const last = plan.places[plan.places.length - 1];
    expect(coords[0]).toEqual([first.lon, first.lat]);
    expect(coords[coords.length - 1]).toEqual([last.lon, last.lat]);
  });
});

describe('fixture plans as a set', () => {
  it('uses distinct plan ids', () => {
    const ids = PLANS.map(([, plan]) => plan.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses place ids that never collide across fixtures', () => {
    const allIds = PLANS.flatMap(([, plan]) => plan.places.map((p) => p.id));
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});
