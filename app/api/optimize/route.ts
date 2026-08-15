import { MOCK } from '@/lib/mock';
import { MAX_STOPS_PER_ROUTE, type OptimizeRequest, type OptimizeResponse } from '@/lib/types';
import { SAMPLE_ROUTE } from '@/lib/fixtures/sample-plan';
import { requestTrip, requestRoute } from '@/lib/routing/osrm';

export async function POST(req: Request) {
  const { stops, mode, roundTrip, fixFirst, fixLast } = (await req.json()) as OptimizeRequest;

  if (!stops?.length) return Response.json({ error: 'stops is required' }, { status: 400 });

  // Above the cap, OSRM's /trip TSP solver is what's off the table — routing
  // itself isn't. requestRoute below computes geometry/totals for the stops'
  // GIVEN order instead (continental-scale trips are hand-ordered, not solved).
  const overCap = stops.length > MAX_STOPS_PER_ROUTE;

  if (MOCK) {
    await new Promise((r) => setTimeout(r, 700));
    // Fixture geometry only lines up for the sample plan; for anything else return the
    // given order so the caller still gets a well-formed Route to render.
    const order = stops.map((s) => s.id);
    const { orderHash: _drop, ...route } = SAMPLE_ROUTE;
    return Response.json({
      order,
      route: { ...route, mode: mode ?? 'driving', roundTrip: roundTrip ?? false, optimized: !overCap },
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
        legs: [],
        totalDistanceM: 0,
        totalDurationS: 0,
        geometry: { type: 'LineString', coordinates: [[stop.lon, stop.lat]] },
        computedAt: new Date().toISOString(),
      },
    } satisfies OptimizeResponse);
  }

  // Track F: OSRM /trip solves order; above the cap, requestRoute below just
  // routes the given order. This file is the only place (plus lib/routing/osrm.ts)
  // that knows the wire format.
  try {
    const { order, route } = overCap
      ? await requestRoute(stops, { mode: mode ?? 'driving', roundTrip: roundTrip ?? false })
      : await requestTrip(stops, {
          mode: mode ?? 'driving',
          roundTrip: roundTrip ?? false,
          fixFirst,
          fixLast,
        });
    return Response.json({ order, route } satisfies OptimizeResponse);
  } catch {
    return Response.json({ error: 'Could not reach the routing service.' }, { status: 502 });
  }
}
