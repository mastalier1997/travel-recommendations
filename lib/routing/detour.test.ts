import { describe, it, expect } from 'vitest';
import { estimateDetourMinutes } from './detour';
import type { Route } from '@/lib/types';
import { place as makePlace } from '@/lib/fixtures/place';

const place = (id: string, lat: number, lon: number) =>
  makePlace({ id, name: id, lat, lon, addedAt: '2026-01-01T00:00:00.000Z' });

describe('estimateDetourMinutes', () => {
  it('returns null with fewer than two confirmed places', () => {
    expect(estimateDetourMinutes({ lat: 1, lon: 1 }, [place('a', 0, 0)], null)).toBeNull();
  });

  it('picks the cheapest-insertion leg among several', () => {
    const places = [place('a', 0, 0), place('b', 0, 1), place('c', 0, 2)];
    // Candidate sits right on the a->b line — near-zero detour there, a real
    // detour anywhere else.
    const candidate = { lat: 0.0001, lon: 0.5 };
    const result = estimateDetourMinutes(candidate, places, null);
    expect(result?.afterPlaceId).toBe('a');
    expect(result?.beforePlaceId).toBe('b');
  });

  it('never returns a negative detour', () => {
    const places = [place('a', 0, 0), place('b', 0, 1)];
    const onTheLine = { lat: 0, lon: 0.5 };
    const result = estimateDetourMinutes(onTheLine, places, null);
    expect(result?.minutes).toBeGreaterThanOrEqual(0);
  });

  it('self-calibrates to the leg speed when a route is given', () => {
    const places = [place('a', 0, 0), place('b', 0, 1)];
    const candidate = { lat: 0.05, lon: 0.5 };
    // A very slow leg (lots of duration for the distance) should imply a bigger
    // detour in minutes than a very fast one for the same physical detour.
    const slow: Route = {
      version: 1,
      provider: 'osrm',
      mode: 'driving',
      roundTrip: false,
      optimized: true,
      orderHash: 'x',
      legs: [{ fromId: 'a', toId: 'b', distanceM: 10_000, durationS: 3_600 }],
      totalDistanceM: 10_000,
      totalDurationS: 3_600,
      geometry: { type: 'LineString', coordinates: [] },
      computedAt: '2026-01-01T00:00:00.000Z',
    };
    const fast: Route = { ...slow, legs: [{ fromId: 'a', toId: 'b', distanceM: 10_000, durationS: 300 }] };

    const slowMinutes = estimateDetourMinutes(candidate, places, slow)?.minutes ?? 0;
    const fastMinutes = estimateDetourMinutes(candidate, places, fast)?.minutes ?? 0;
    expect(slowMinutes).toBeGreaterThan(fastMinutes);
  });
});
