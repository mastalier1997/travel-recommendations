import { MOCK, notImplemented } from '@/lib/mock';
import { MAX_STOPS_PER_ROUTE, type OptimizeRequest, type OptimizeResponse } from '@/lib/types';
import { SAMPLE_ROUTE } from '@/lib/fixtures/sample-plan';

export async function POST(req: Request) {
  const { stops, mode, roundTrip } = (await req.json()) as OptimizeRequest;

  if (!stops?.length) return Response.json({ error: 'stops is required' }, { status: 400 });

  // Enforced in mock too — the cap is contract behaviour the UI has to render,
  // not an OSRM implementation detail.
  if (stops.length > MAX_STOPS_PER_ROUTE) {
    return Response.json(
      { error: `Routes are limited to ${MAX_STOPS_PER_ROUTE} stops. Remove ${stops.length - MAX_STOPS_PER_ROUTE} to optimize.` },
      { status: 422 },
    );
  }

  if (MOCK) {
    await new Promise((r) => setTimeout(r, 700));
    // Fixture geometry only lines up for the sample plan; for anything else return the
    // given order so the caller still gets a well-formed Route to render.
    const order = stops.map((s) => s.id);
    const { orderHash: _drop, ...route } = SAMPLE_ROUTE;
    return Response.json({
      order,
      route: { ...route, mode: mode ?? 'driving', roundTrip: roundTrip ?? false },
    } satisfies OptimizeResponse);
  }

  // Track F: OSRM /trip. Above the cap, swap to /table + nearest-neighbour + 2-opt and
  // one /route call for geometry. This file is the only place that knows the wire format.
  return notImplemented('F');
}
