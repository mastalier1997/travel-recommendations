import { describe, it, expect } from 'vitest';
import { toTripResult } from './osrm';

const stop = (id: string, lat: number, lon: number) => ({ id, lat, lon });

const okResponse = (waypointOrder: number[]) => ({
  code: 'Ok',
  trips: [
    {
      distance: 6120.9,
      duration: 795.6,
      legs: waypointOrder.slice(0, -1).map((_, i) => ({ distance: 100 * (i + 1), duration: 60 * (i + 1) })),
      geometry: {
        type: 'LineString' as const,
        coordinates: [[135.77, 34.97], [135.78, 34.98]] as [number, number][],
      },
    },
  ],
  waypoints: waypointOrder.map((waypoint_index) => ({ waypoint_index })),
});

describe('toTripResult', () => {
  it('keeps identity order when nothing moved', () => {
    const stops = [stop('a', 1, 1), stop('b', 2, 2), stop('c', 3, 3)];
    const { order } = toTripResult(stops, okResponse([0, 1, 2]), { mode: 'driving', roundTrip: false });
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('handles a full reversal', () => {
    const stops = [stop('a', 1, 1), stop('b', 2, 2), stop('c', 3, 3)];
    const { order } = toTripResult(stops, okResponse([2, 1, 0]), { mode: 'driving', roundTrip: false });
    expect(order).toEqual(['c', 'b', 'a']);
  });

  it('inverts a partial swap — verified live against the OSRM demo server', () => {
    // Input [Fushimi, Nishiki, Kiyomizu, Dotonbori]; OSRM returned
    // waypoint_index [0, 2, 1, 3], meaning solved order swaps Nishiki and Kiyomizu.
    const stops = [
      stop('fushimi', 34.9671, 135.7727),
      stop('nishiki', 35.0051, 135.7645),
      stop('kiyomizu', 34.9948, 135.785),
      stop('dotonbori', 34.6687, 135.5015),
    ];
    const { order } = toTripResult(stops, okResponse([0, 2, 1, 3]), {
      mode: 'driving',
      roundTrip: false,
    });
    expect(order).toEqual(['fushimi', 'kiyomizu', 'nishiki', 'dotonbori']);
  });

  it('builds legs against the reordered ids, not the input ids', () => {
    const stops = [stop('a', 1, 1), stop('b', 2, 2), stop('c', 3, 3)];
    const { route } = toTripResult(stops, okResponse([2, 1, 0]), { mode: 'driving', roundTrip: false });
    expect(route.legs).toEqual([
      { fromId: 'c', toId: 'b', distanceM: 100, durationS: 60 },
      { fromId: 'b', toId: 'a', distanceM: 200, durationS: 120 },
    ]);
  });

  it('carries mode, roundTrip and totals onto the route', () => {
    const stops = [stop('a', 1, 1), stop('b', 2, 2)];
    const { route } = toTripResult(stops, okResponse([0, 1]), { mode: 'walking', roundTrip: true });
    expect(route.mode).toBe('walking');
    expect(route.roundTrip).toBe(true);
    expect(route.optimized).toBe(true);
    expect(route.totalDistanceM).toBe(6120.9);
    expect(route.totalDurationS).toBe(795.6);
    expect(route.provider).toBe('osrm');
  });

  it('throws when OSRM returns a non-Ok code', () => {
    const stops = [stop('a', 1, 1), stop('b', 2, 2)];
    expect(() =>
      toTripResult(stops, { code: 'NoTrip' }, { mode: 'driving', roundTrip: false }),
    ).toThrow(/NoTrip/);
  });
});
