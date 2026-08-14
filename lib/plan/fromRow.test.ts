import { describe, it, expect } from 'vitest';
import { planFromRow } from './fromRow';
import { SAMPLE_PLAN } from '@/lib/fixtures/sample-plan';
import { isRouteStale } from '@/lib/routing/order';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  user_id: 'u1',
  title: 'Japan – Spring 2026',
  places: SAMPLE_PLAN.places,
  route: SAMPLE_PLAN.route,
  version: 3,
  updated_at: '2026-08-01T09:00:00.000Z',
  ...over,
});

describe('planFromRow', () => {
  it('round-trips a well-formed row', () => {
    const plan = planFromRow(row());
    expect(plan.places).toHaveLength(9);
    expect(plan.version).toBe(3);
    expect(isRouteStale(plan.places, plan.route)).toBe(false);
  });

  it('survives an empty plan', () => {
    const plan = planFromRow(row({ places: [], route: null }));
    expect(plan.places).toEqual([]);
    expect(plan.route).toBeNull();
  });

  it('defaults a blank title rather than rendering an empty header', () => {
    expect(planFromRow(row({ title: '   ' })).title).toBe('Untitled plan');
    expect(planFromRow(row({ title: null })).title).toBe('Untitled plan');
  });

  it('drops junk entries from places', () => {
    const plan = planFromRow(row({ places: [null, 'nope', { noId: true }, SAMPLE_PLAN.places[0]] }));
    expect(plan.places).toHaveLength(1);
    expect(plan.places[0].name).toBe('Fushimi Inari Taisha');
  });

  it('forces a coordinate-less place to unresolved whatever the row claims', () => {
    const bad = { ...SAMPLE_PLAN.places[0], lat: null, lon: null, status: 'confirmed' };
    expect(planFromRow(row({ places: [bad] })).places[0].status).toBe('unresolved');
  });

  it('discards a route with no usable geometry', () => {
    expect(planFromRow(row({ route: { legs: [], totalDistanceM: 5 } })).route).toBeNull();
    expect(planFromRow(row({ route: 'nonsense' })).route).toBeNull();
  });

  it('drops legs that reference places no longer in the plan', () => {
    const plan = planFromRow(row({ places: SAMPLE_PLAN.places.slice(0, 3) }));
    expect(plan.route?.legs).toHaveLength(2);
  });

  it('keeps a stale orderHash so staleness stays detectable', () => {
    const reversed = [...SAMPLE_PLAN.places].reverse();
    const plan = planFromRow(row({ places: reversed }));
    expect(isRouteStale(plan.places, plan.route)).toBe(true);
  });
});
