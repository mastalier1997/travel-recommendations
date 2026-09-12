import { MOCK } from '@/lib/mock';
import {
  OSRM_TRIP_MAX_STOPS,
  MAX_STOPS_SOLVED,
  type OptimizeRequest,
  type OptimizeResponse,
} from '@/lib/types';
import { SAMPLE_ROUTE } from '@/lib/fixtures/sample-plan';
import { requestTrip, requestRoute, requestSolvedRoute, OsrmUnroutableError } from '@/lib/routing/osrm';
import { solveOrder } from '@/lib/routing/solve';
import { haversineMatrix } from '@/lib/routing/haversine';
import { simplifyToMaxPoints, type Point } from '@/lib/geo/simplify';

/** Above this, a turn-by-turn OSRM trace (thousands of points on a continental
 * trip) is too dense to be worth rendering or shipping to the client — see
 * Route.generalized in lib/types.ts. */
const MAX_GEOMETRY_POINTS = 500;

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
        generalized: !withinExact,
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
    return Response.json({
      order,
      route: withinExact ? route : generalize(route),
    } satisfies OptimizeResponse);
  } catch (err) {
    console.error('[optimize] OSRM request failed:', err);
    // Distinct from a service failure: OSRM answered fine and says no route exists
    // by road between these stops at all — e.g. islands with no ferry connection in
    // its graph (a Kuala Lumpur -> Bali "driving" trip, say). Retrying won't help;
    // the stop list itself needs to change.
    if (err instanceof OsrmUnroutableError) {
      return Response.json(
        {
          error:
            'No route found between these stops — one may not be reachable by road (for example, separated by water with no ferry in our map data). Try removing or relocating it.',
        },
        { status: 422 },
      );
    }
    return Response.json({ error: 'Could not reach the routing service.' }, { status: 502 });
  }
}

/** A continental-scale trip's turn-by-turn OSRM geometry is thousands of points —
 * too dense to be worth rendering or shipping to the client. Simplify and flag it
 * so the UI can say so (see Route.generalized in lib/types.ts) rather than imply
 * the shown distance/time figures are turn-by-turn precise when they're not. */
function generalize<T extends Awaited<ReturnType<typeof requestTrip>>['route']>(route: T): T {
  return {
    ...route,
    geometry: {
      ...route.geometry,
      coordinates: simplifyToMaxPoints(route.geometry.coordinates as Point[], MAX_GEOMETRY_POINTS),
    },
    generalized: true,
  };
}
