import type { Route, RouteLeg, TravelMode } from '@/lib/types';

const OSRM_URL = process.env.OSRM_URL ?? 'https://router.project-osrm.org';

/**
 * Shape of OSRM's /trip response. Verified live against the public demo server —
 * `waypoints[]` is in INPUT order, not solved order; `waypoints[i].waypoint_index`
 * says where input stop i landed in the solved trip. `trips[0].legs[]` is in
 * solved order.
 */
type OsrmTripResponse = {
  code: string;
  trips?: {
    distance: number;
    duration: number;
    legs: { distance: number; duration: number }[];
    geometry: { type: 'LineString'; coordinates: [number, number][] };
  }[];
  waypoints?: { waypoint_index: number }[];
};

export type OsrmTripResult = {
  order: string[];
  route: Omit<Route, 'orderHash'>;
};

/** Shape of OSRM's /route response — geometry/legs for a FIXED order, no permutation search. */
type OsrmRouteResponse = {
  code: string;
  routes?: {
    distance: number;
    duration: number;
    legs: { distance: number; duration: number }[];
    geometry: { type: 'LineString'; coordinates: [number, number][] };
  }[];
};

export async function requestTrip(
  stops: { id: string; lat: number; lon: number }[],
  opts: { mode: TravelMode; roundTrip: boolean; fixFirst?: boolean; fixLast?: boolean },
): Promise<OsrmTripResult> {
  const coords = stops.map((s) => `${s.lon},${s.lat}`).join(';');
  const url = new URL(`/trip/v1/${opts.mode}/${coords}`, OSRM_URL);
  url.searchParams.set('roundtrip', String(opts.roundTrip));
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'full');
  // Verified live: the demo server 400s on roundtrip=false with neither endpoint fixed
  // ({"code":"NotImplemented"}). The UI never sets fixFirst/fixLast today, so default to
  // pinning the first stop — matches "start where I put my first pin", the natural reading
  // of a one-way trip.
  const fixFirst = opts.fixFirst || (!opts.roundTrip && !opts.fixLast);
  if (fixFirst) url.searchParams.set('source', 'first');
  if (opts.fixLast) url.searchParams.set('destination', 'last');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM responded ${res.status}`);
  const data = (await res.json()) as OsrmTripResponse;

  return toTripResult(stops, data, opts);
}

export function toTripResult(
  stops: { id: string; lat: number; lon: number }[],
  data: OsrmTripResponse,
  opts: { mode: TravelMode; roundTrip: boolean },
): OsrmTripResult {
  // OSRM returns "NoTrip" (no route exists at all, e.g. an unreachable island stop) or
  // other non-"Ok" codes on failure — surface that instead of indexing into undefined.
  if (data.code !== 'Ok' || !data.trips?.[0] || !data.waypoints) {
    throw new Error(`OSRM trip failed: ${data.code}`);
  }

  // waypoints[] is in input order; invert it to get solved order. See module comment.
  const order = new Array<string>(stops.length);
  data.waypoints.forEach((wp, inputIndex) => {
    order[wp.waypoint_index] = stops[inputIndex].id;
  });

  const trip = data.trips[0];
  const legs: RouteLeg[] = trip.legs.map((leg, i) => ({
    fromId: order[i],
    toId: order[i + 1],
    distanceM: leg.distance,
    durationS: leg.duration,
  }));

  return {
    order,
    route: {
      version: 1,
      provider: 'osrm',
      mode: opts.mode,
      roundTrip: opts.roundTrip,
      optimized: true,
      legs,
      totalDistanceM: trip.distance,
      totalDurationS: trip.duration,
      geometry: trip.geometry,
      computedAt: new Date().toISOString(),
    },
  };
}

/**
 * Geometry/totals for stops in their GIVEN order — no permutation search. This is
 * what continental-scale trips (above MAX_STOPS_PER_ROUTE) use instead of /trip:
 * OSRM's TSP solver is what's capped, not routing itself. Track F: this file is
 * the only place (plus app/api/optimize/route.ts) that knows the wire format.
 */
export async function requestRoute(
  stops: { id: string; lat: number; lon: number }[],
  opts: { mode: TravelMode; roundTrip: boolean },
): Promise<OsrmTripResult> {
  const coords = stops.map((s) => `${s.lon},${s.lat}`).join(';');
  const url = new URL(`/route/v1/${opts.mode}/${coords}`, OSRM_URL);
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'full');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM responded ${res.status}`);
  const data = (await res.json()) as OsrmRouteResponse;
  return toRouteResult(stops, data, opts);
}

export function toRouteResult(
  stops: { id: string; lat: number; lon: number }[],
  data: OsrmRouteResponse,
  opts: { mode: TravelMode; roundTrip: boolean },
): OsrmTripResult {
  if (data.code !== 'Ok' || !data.routes?.[0]) {
    throw new Error(`OSRM route failed: ${data.code}`);
  }

  const order = stops.map((s) => s.id);
  const solved = data.routes[0];
  const legs: RouteLeg[] = solved.legs.map((leg, i) => ({
    fromId: order[i],
    toId: order[i + 1],
    distanceM: leg.distance,
    durationS: leg.duration,
  }));

  return {
    order,
    route: {
      version: 1,
      provider: 'osrm',
      mode: opts.mode,
      roundTrip: opts.roundTrip,
      optimized: false,
      legs,
      totalDistanceM: solved.distance,
      totalDurationS: solved.duration,
      geometry: solved.geometry,
      computedAt: new Date().toISOString(),
    },
  };
}
