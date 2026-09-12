import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { solveAndRouteFromTable, requestRouteWithGaps, OsrmUnroutableError, type OsrmTableResult } from './osrm';

// Exercises the orchestration layer (fuse -> solve -> route-with-gaps) against a
// mocked fetch, since lib/routing/osrm.test.ts deliberately keeps to pure
// functions only. Real OSRM /route wire responses, same shape as those tests use.
const routeResponse = (legCount: number, coords: [number, number][] = [[0, 0], [1, 1]]) => ({
  code: 'Ok',
  routes: [
    {
      distance: 1000 * (legCount || 1),
      duration: 600 * (legCount || 1),
      legs: Array.from({ length: legCount }, (_, i) => ({ distance: 1000 * (i + 1), duration: 600 * (i + 1) })),
      geometry: { type: 'LineString' as const, coordinates: coords },
    },
  ],
});

const noRouteResponse = () => ({ code: 'NoRoute' });

function stop(id: string, lat: number, lon: number) {
  return { id, lat, lon };
}

describe('solveAndRouteFromTable', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('makes exactly one /route call and no direct legs when the whole order is reachable', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(routeResponse(1)), { status: 200 }));

    const stops = [stop('a', 0, 0), stop('b', 0, 1)];
    const table: OsrmTableResult = {
      durations: [
        [0, 100],
        [100, 0],
      ],
      distances: [
        [0, 1000],
        [1000, 0],
      ],
      unreachable: [
        [false, false],
        [false, false],
      ],
    };

    const result = await solveAndRouteFromTable(stops, table, { mode: 'driving', roundTrip: false }, AbortSignal.timeout(5000));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.route.legs.every((l) => l.mode !== 'direct')).toBe(true);
    expect(result.route.directLegCount).toBeUndefined();
    // No gap anywhere: per-leg geometry is stripped back off (buildRoute), same
    // payload shape as before this feature existed.
    expect(result.route.legs.every((l) => l.geometry === undefined)).toBe(true);
  });

  it('routes each side of a gap separately and connects them with a direct leg', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(routeResponse(0)), { status: 200 }));

    // Two stops, no road connection either way — a genuine split, not an error.
    const stops = [stop('kl', 3.15, 101.71), stop('jakarta', -6.17, 106.83)];
    const table: OsrmTableResult = {
      durations: [
        [0, Number.MAX_SAFE_INTEGER],
        [Number.MAX_SAFE_INTEGER, 0],
      ],
      distances: [
        [0, Number.MAX_SAFE_INTEGER],
        [Number.MAX_SAFE_INTEGER, 0],
      ],
      unreachable: [
        [false, true],
        [true, false],
      ],
    };

    const result = await solveAndRouteFromTable(stops, table, { mode: 'driving', roundTrip: false }, AbortSignal.timeout(5000));

    // Both stops are single-stop runs — nothing to route with /route at all.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.route.legs).toHaveLength(1);
    expect(result.route.legs[0].mode).toBe('direct');
    expect(result.route.legs[0].durationS).toBeUndefined();
    expect(result.route.legs[0].distanceM).toBeGreaterThan(0);
    expect(result.route.directLegCount).toBe(1);
    expect(result.route.totalDurationS).toBe(0);
  });

  it('throws OsrmUnroutableError with a stopId for a truly isolated stop, without ever calling fetch', async () => {
    // b is cut off from BOTH a and c; a<->c stays fine — a real majority exists,
    // so this is the one case that still errors instead of drawing a direct line.
    const stops = [stop('a', 0, 0), stop('b', 10, 10), stop('c', 0, 1)];
    const table: OsrmTableResult = {
      durations: [
        [0, Number.MAX_SAFE_INTEGER, 100],
        [Number.MAX_SAFE_INTEGER, 0, Number.MAX_SAFE_INTEGER],
        [100, Number.MAX_SAFE_INTEGER, 0],
      ],
      distances: [
        [0, 0, 1000],
        [0, 0, 0],
        [1000, 0, 0],
      ],
      unreachable: [
        [false, true, false],
        [true, false, true],
        [false, true, false],
      ],
    };

    await expect(
      solveAndRouteFromTable(stops, table, { mode: 'driving', roundTrip: false }, AbortSignal.timeout(5000)),
    ).rejects.toMatchObject({ diagnosis: { stopId: 'b' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses fuseMatrix.gapDistances (not a re-derived value) for a gap leg\'s distanceM', async () => {
    // Same shape as the "routes each side of a gap" case above, but asserts the
    // exact number came from the fused matrix specifically — guards against the
    // display distance and the solver's estimate silently drifting apart.
    const stops = [stop('a', 0, 0), stop('b', 0, 1)];
    const table: OsrmTableResult = {
      durations: [
        [0, Number.MAX_SAFE_INTEGER],
        [Number.MAX_SAFE_INTEGER, 0],
      ],
      distances: [
        [0, Number.MAX_SAFE_INTEGER],
        [Number.MAX_SAFE_INTEGER, 0],
      ],
      unreachable: [
        [false, true],
        [true, false],
      ],
    };
    const result = await solveAndRouteFromTable(stops, table, { mode: 'driving', roundTrip: false }, AbortSignal.timeout(5000));
    const { haversineDistance } = await import('./haversine');
    expect(result.route.legs[0].distanceM).toBe(haversineDistance(stops[0], stops[1]));
  });

  it('closes a gap-free round trip with one extra /route call for the closing leg', async () => {
    // A fresh Response per call — a single shared instance can't have its body
    // read twice.
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(routeResponse(1)), { status: 200 }));

    const stops = [stop('a', 0, 0), stop('b', 0, 1), stop('c', 0, 2)];
    const table: OsrmTableResult = {
      durations: [
        [0, 100, 100],
        [100, 0, 100],
        [100, 100, 0],
      ],
      distances: [
        [0, 1000, 1000],
        [1000, 0, 1000],
        [1000, 1000, 0],
      ],
      unreachable: [
        [false, false, false],
        [false, false, false],
        [false, false, false],
      ],
    };

    const result = await solveAndRouteFromTable(stops, table, { mode: 'driving', roundTrip: true }, AbortSignal.timeout(5000));

    // One call for the open path (2 legs) + one for the closing pair.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.route.legs.every((l) => l.mode !== 'direct')).toBe(true);
  });

  it('closes a round trip with a direct leg when the wraparound pair is itself a gap', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(routeResponse(1)), { status: 200 }));

    // a<->b and b<->c are real; a<->c (the wraparound closing pair) is a gap.
    const stops = [stop('a', 0, 0), stop('b', 0, 1), stop('c', 0, 2)];
    const table: OsrmTableResult = {
      durations: [
        [0, 100, Number.MAX_SAFE_INTEGER],
        [100, 0, 100],
        [Number.MAX_SAFE_INTEGER, 100, 0],
      ],
      distances: [
        [0, 1000, Number.MAX_SAFE_INTEGER],
        [1000, 0, 1000],
        [Number.MAX_SAFE_INTEGER, 1000, 0],
      ],
      unreachable: [
        [false, false, true],
        [false, false, false],
        [true, false, false],
      ],
    };

    const result = await solveAndRouteFromTable(stops, table, { mode: 'driving', roundTrip: true }, AbortSignal.timeout(5000));

    // Only the open path needed a real /route call — the closing pair is a known
    // gap, so it's a direct leg with no wasted call attempted on it.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.route.legs.some((l) => l.mode === 'direct')).toBe(true);
    expect(result.route.legs.at(-1)?.mode).toBe('direct');
  });

  it('bisects a >2-stop run when the mask says it should route but /route disagrees, within the call budget', async () => {
    // All three stops show as mutually reachable in the matrix, but the single
    // whole-run /route call fails — routeSpan must bisect rather than propagate.
    let calls = 0;
    fetchMock.mockImplementation(async (url: URL) => {
      calls++;
      const coordCount = String(url).split('/').pop()!.split(';').length;
      if (coordCount === 3) return new Response(JSON.stringify(noRouteResponse()), { status: 400 });
      return new Response(JSON.stringify(routeResponse(1)), { status: 200 });
    });

    const stops = [stop('a', 0, 0), stop('b', 0, 1), stop('c', 0, 2)];
    const table: OsrmTableResult = {
      durations: [
        [0, 100, 200],
        [100, 0, 100],
        [200, 100, 0],
      ],
      distances: [
        [0, 1000, 2000],
        [1000, 0, 1000],
        [2000, 1000, 0],
      ],
      unreachable: [
        [false, false, false],
        [false, false, false],
        [false, false, false],
      ],
    };

    const result = await solveAndRouteFromTable(stops, table, { mode: 'driving', roundTrip: false }, AbortSignal.timeout(5000));

    // 1 failed whole-run call + 2 successful bisected-half calls.
    expect(calls).toBe(3);
    expect(result.route.legs).toHaveLength(2);
    expect(result.route.legs.every((l) => l.mode !== 'direct')).toBe(true);
  });

  it('degrades to direct legs once the call budget is exhausted, never throwing or hanging', async () => {
    // Every /route call fails — a pathological run should still terminate by
    // bisecting down to individual direct legs once MAX_ROUTE_CALLS is spent,
    // not loop forever or propagate the /route failure.
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(noRouteResponse()), { status: 400 }));

    const n = 6;
    const stops = Array.from({ length: n }, (_, i) => stop(String(i), 0, i));
    const durations = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : 100)));
    const distances = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : 1000)));
    const unreachable = Array.from({ length: n }, () => new Array(n).fill(false));
    const table: OsrmTableResult = { durations, distances, unreachable };

    const result = await solveAndRouteFromTable(stops, table, { mode: 'driving', roundTrip: false }, AbortSignal.timeout(5000));

    expect(result.route.legs).toHaveLength(n - 1);
    expect(result.route.legs.every((l) => l.mode === 'direct')).toBe(true);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(8); // MAX_ROUTE_CALLS
  });
});

describe('requestRouteWithGaps', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('bisects and degrades to a direct leg when the whole-sequence call fails, with no upfront gap knowledge', async () => {
    // No /table for this tier — the first call (all 3 stops) fails; it bisects
    // into two 2-stop calls, one of which also fails and degrades to direct.
    let call = 0;
    fetchMock.mockImplementation(async (url: URL) => {
      call++;
      const coordCount = String(url).split('/').pop()!.split(';').length;
      if (coordCount === 3) return new Response(JSON.stringify(noRouteResponse()), { status: 400 });
      // One of the two-stop halves fails too (simulating a genuine gap within it).
      if (call === 3) return new Response(JSON.stringify(noRouteResponse()), { status: 400 });
      return new Response(JSON.stringify(routeResponse(1)), { status: 200 });
    });

    const stops = [stop('a', 0, 0), stop('b', 0, 1), stop('c', 0, 2)];
    const result = await requestRouteWithGaps(stops, { mode: 'driving', roundTrip: false }, AbortSignal.timeout(5000));

    expect(result.route.legs).toHaveLength(2);
    expect(result.route.legs.some((l) => l.mode === 'direct')).toBe(true);
    expect(result.route.optimized).toBe(false);
    expect(result.route.optimizationMethod).toBe('none');
  });
});
