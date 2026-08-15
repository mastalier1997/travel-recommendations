import { MOCK } from '@/lib/mock';
import {
  OSRM_TRIP_MAX_STOPS,
  MAX_STOPS_SOLVED,
  type OptimizeRequest,
  type OptimizeResponse,
} from '@/lib/types';
import { SAMPLE_ROUTE } from '@/lib/fixtures/sample-plan';
import { requestTrip, requestRoute, requestSolvedRoute } from '@/lib/routing/osrm';
import { solveOrder } from '@/lib/routing/solve';
import { haversineMatrix } from '@/lib/routing/haversine';

export const maxDuration = 20;

export async function POST(req: Request) {
  const { stops, mode, roundTrip, fixFirst, fixLast } = (await req.json()) as OptimizeRequest;

  if (!stops?.length) return Response.json({ error: 'stops is required' }, { status: 400 });

  // Three tiers: OSRM's own /trip TSP solver (exact, small n), the local
  // nearest-neighbor+2-opt heuristic (lib/routing/solve.ts, needs OSRM's /table —
  // capped at 100 coordinates on the public demo server, verified live), then above
  // that, routing without reordering (today's original fallback).
  const withinExact = stops.length <= OSRM_TRIP_MAX_STOPS;
  const withinHeuristic = stops.length <= MAX_STOPS_SOLVED;

  if (MOCK) {
    await new Promise((r) => setTimeout(r, 700));
    // Real reordering with zero network: solve on straight-line distance instead of
    // OSRM's /table. Fixture geometry only lines up for the sample plan's original
    // order — after reordering it matches even less, which is already the case today.
    const order = withinExact
      ? stops.map((s) => s.id)
      : withinHeuristic
        ? solveOrder(haversineMatrix(stops), {
            roundTrip: roundTrip ?? false,
            fixFirst,
            fixLast,
          }).map((i) => stops[i].id)
        : stops.map((s) => s.id);
    const { orderHash: _drop, ...route } = SAMPLE_ROUTE;
    return Response.json({
      order,
      route: {
        ...route,
        mode: mode ?? 'driving',
        roundTrip: roundTrip ?? false,
        optimized: withinHeuristic,
        optimizationMethod: withinExact ? 'exact' : withinHeuristic ? 'heuristic' : 'none',
      },
    } satisfies OptimizeResponse);
  }

  // A single stop has nothing to solve, and OSRM 400s on fewer than 2 coordinates.
  if (stops.length === 1) {
    const [stop] = stops;
    return Response.json({
      order: [stop.id],
      route: {
        version: 1,
        provider: 'osrm',
        mode: mode ?? 'driving',
        roundTrip: roundTrip ?? false,
        optimized: true,
        optimizationMethod: 'exact',
        legs: [],
        totalDistanceM: 0,
        totalDurationS: 0,
        geometry: { type: 'LineString', coordinates: [[stop.lon, stop.lat]] },
        computedAt: new Date().toISOString(),
      },
    } satisfies OptimizeResponse);
  }

  // This file (plus lib/routing/osrm.ts) is the only place that knows the wire format.
  try {
    const { order, route } = withinExact
      ? await requestTrip(stops, {
          mode: mode ?? 'driving',
          roundTrip: roundTrip ?? false,
          fixFirst,
          fixLast,
        })
      : withinHeuristic
        ? await requestSolvedRoute(stops, { mode: mode ?? 'driving', roundTrip: roundTrip ?? false, fixFirst, fixLast })
        : await requestRoute(stops, { mode: mode ?? 'driving', roundTrip: roundTrip ?? false });
    return Response.json({ order, route } satisfies OptimizeResponse);
  } catch {
    return Response.json({ error: 'Could not reach the routing service.' }, { status: 502 });
  }
}
