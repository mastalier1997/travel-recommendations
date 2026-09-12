import { describe, it, expect } from 'vitest';
import { toTripResult, toRouteResult, toTableResult, throwOnError, OsrmUnroutableError } from './osrm';

describe('throwOnError', () => {
  it('does nothing on a successful response', async () => {
    await expect(throwOnError(new Response('{}', { status: 200 }), 'trip')).resolves.toBeUndefined();
  });

  it("surfaces OSRM's own error code and status, not just the bare status", async () => {
    const body = JSON.stringify({ code: 'NotImplemented', message: 'This request is not supported' });
    await expect(throwOnError(new Response(body, { status: 400 }), 'trip')).rejects.toThrow(
      /OSRM \/trip responded 400.*NotImplemented/s,
    );
  });

  it('throws OsrmUnroutableError (not a generic Error) when OSRM says no trip is possible', async () => {
    // Verified live: the public demo server delivers this as HTTP 400, e.g. for a
    // Kuala Lumpur -> Bali "driving" request with no road/ferry connection.
    const body = JSON.stringify({ code: 'NoTrips', message: 'No trip visiting all destinations possible.' });
    await expect(throwOnError(new Response(body, { status: 400 }), 'trip')).rejects.toBeInstanceOf(
      OsrmUnroutableError,
    );
  });

  it('does not misclassify an unrelated error code as unroutable', async () => {
    const body = JSON.stringify({ code: 'InvalidUrl', message: 'URL string is invalid' });
    const err = await throwOnError(new Response(body, { status: 400 }), 'trip').catch((e) => e);
    expect(err).not.toBeInstanceOf(OsrmUnroutableError);
  });
});

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

  it('throws OsrmUnroutableError specifically for an unroutable code', () => {
    const stops = [stop('a', 1, 1), stop('b', 2, 2)];
    expect(() =>
      toTripResult(stops, { code: 'NoTrips' }, { mode: 'driving', roundTrip: false }),
    ).toThrow(OsrmUnroutableError);
  });
});

const okRouteResponse = (legCount: number) => ({
  code: 'Ok',
  routes: [
    {
      distance: 5940000,
      duration: 246300,
      legs: Array.from({ length: legCount }, (_, i) => ({ distance: 100 * (i + 1), duration: 60 * (i + 1) })),
      geometry: {
        type: 'LineString' as const,
        coordinates: [[135.77, 34.97], [135.78, 34.98]] as [number, number][],
      },
    },
  ],
});

describe('toRouteResult', () => {
  it('never reorders — order is always the given input order', () => {
    const stops = [stop('a', 1, 1), stop('b', 2, 2), stop('c', 3, 3)];
    const { order } = toRouteResult(stops, okRouteResponse(2), { mode: 'driving', roundTrip: false });
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('builds legs against the input ids, in input order', () => {
    const stops = [stop('a', 1, 1), stop('b', 2, 2), stop('c', 3, 3)];
    const { route } = toRouteResult(stops, okRouteResponse(2), { mode: 'driving', roundTrip: false });
    expect(route.legs).toEqual([
      { fromId: 'a', toId: 'b', distanceM: 100, durationS: 60 },
      { fromId: 'b', toId: 'c', distanceM: 200, durationS: 120 },
    ]);
  });

  it('marks the route unoptimized', () => {
    const stops = [stop('a', 1, 1), stop('b', 2, 2)];
    const { route } = toRouteResult(stops, okRouteResponse(1), { mode: 'driving', roundTrip: false });
    expect(route.optimized).toBe(false);
    expect(route.totalDistanceM).toBe(5940000);
    expect(route.totalDurationS).toBe(246300);
  });

  it('throws when OSRM returns a non-Ok code', () => {
    const stops = [stop('a', 1, 1), stop('b', 2, 2)];
    expect(() =>
      toRouteResult(stops, { code: 'NoRoute' }, { mode: 'driving', roundTrip: false }),
    ).toThrow(/NoRoute/);
  });

  it('throws OsrmUnroutableError specifically for an unroutable code', () => {
    const stops = [stop('a', 1, 1), stop('b', 2, 2)];
    expect(() =>
      toRouteResult(stops, { code: 'NoRoute' }, { mode: 'driving', roundTrip: false }),
    ).toThrow(OsrmUnroutableError);
  });

  it('wraps the closing leg back to the first stop on a round trip', () => {
    // requestRoute appends stop 0's coordinates again for roundTrip, so OSRM
    // returns one more leg (3) than `order` has entries (3 stops) — the last
    // leg's toId must wrap via modulo, not read order[3] (undefined).
    const stops = [stop('a', 1, 1), stop('b', 2, 2), stop('c', 3, 3)];
    const { route } = toRouteResult(stops, okRouteResponse(3), { mode: 'driving', roundTrip: true });
    expect(route.legs).toEqual([
      { fromId: 'a', toId: 'b', distanceM: 100, durationS: 60 },
      { fromId: 'b', toId: 'c', distanceM: 200, durationS: 120 },
      { fromId: 'c', toId: 'a', distanceM: 300, durationS: 180 },
    ]);
  });
});

describe('toTableResult', () => {
  const okTableResponse = () => ({
    code: 'Ok',
    durations: [
      [0, 60, 120],
      [60, 0, 90],
      [120, 90, 0],
    ],
    distances: [
      [0, 1000, 2000],
      [1000, 0, 1500],
      [2000, 1500, 0],
    ],
  });

  it('returns the duration/distance matrices as-is when every pair is reachable', () => {
    const result = toTableResult(okTableResponse());
    expect(result.durations).toEqual([
      [0, 60, 120],
      [60, 0, 90],
      [120, 90, 0],
    ]);
    expect(result.distances[0][2]).toBe(2000);
  });

  it('replaces an unreachable (null) pair with a very large cost instead of null', () => {
    const data = okTableResponse();
    data.durations[0][2] = null as unknown as number;
    const result = toTableResult(data);
    expect(result.durations[0][2]).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('exposes which pairs were null instead of only discarding them', () => {
    const data = okTableResponse();
    data.durations[0][2] = null as unknown as number;
    const result = toTableResult(data);
    expect(result.unreachable[0][2]).toBe(true);
    expect(result.unreachable[0][1]).toBe(false);
  });

  it('throws when OSRM returns a non-Ok code', () => {
    expect(() => toTableResult({ code: 'NoTable' })).toThrow(/NoTable/);
  });
});
