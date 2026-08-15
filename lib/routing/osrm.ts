import type { Route, RouteLeg, TravelMode } from '@/lib/types';
import { solveOrder } from './solve';

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
      optimizationMethod: 'exact',
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
  signal?: AbortSignal,
): Promise<OsrmTripResult> {
  // /route has no roundtrip concept of its own — get the closing leg by literally
  // repeating the first stop's coordinates as the last waypoint.
  const closing = opts.roundTrip && stops.length > 1 ? [stops[0]] : [];
  const coords = [...stops, ...closing].map((s) => `${s.lon},${s.lat}`).join(';');
  const url = new URL(`/route/v1/${opts.mode}/${coords}`, OSRM_URL);
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'full');

  const res = await fetch(url, { signal });
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
  // Modulo, not a plain `+1`: with `roundTrip`, the closing coordinate above gives
  // OSRM one more leg than `order` has entries — this wraps that last leg's `toId`
  // back to order[0] instead of reading past the end of the array.
  const legs: RouteLeg[] = solved.legs.map((leg, i) => ({
    fromId: order[i],
    toId: order[(i + 1) % order.length],
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
      optimizationMethod: 'none',
      legs,
      totalDistanceM: solved.distance,
      totalDurationS: solved.duration,
      geometry: solved.geometry,
      computedAt: new Date().toISOString(),
    },
  };
}

/** Shape of OSRM's /table response — an NxN duration/distance matrix, no permutation
 * search on OSRM's side (unlike /trip), which is what makes it cheap enough to use
 * above OSRM_TRIP_MAX_STOPS. */
type OsrmTableResponse = {
  code: string;
  durations?: (number | null)[][];
  distances?: (number | null)[][];
};

export type OsrmTableResult = { durations: number[][]; distances: number[][] };

export async function requestTable(
  stops: { id: string; lat: number; lon: number }[],
  opts: { mode: TravelMode },
  signal?: AbortSignal,
): Promise<OsrmTableResult> {
  const coords = stops.map((s) => `${s.lon},${s.lat}`).join(';');
  const url = new URL(`/table/v1/${opts.mode}/${coords}`, OSRM_URL);
  url.searchParams.set('annotations', 'duration,distance');

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`OSRM responded ${res.status}`);
  const data = (await res.json()) as OsrmTableResponse;
  return toTableResult(data);
}

export function toTableResult(data: OsrmTableResponse): OsrmTableResult {
  if (data.code !== 'Ok' || !data.durations || !data.distances) {
    throw new Error(`OSRM table failed: ${data.code}`);
  }
  // A pair OSRM can't route between at all comes back null — treat it as "very
  // far" so the solver's comparisons stay well-defined instead of NaN-poisoning.
  const clean = (row: (number | null)[]) => row.map((v) => v ?? Number.MAX_SAFE_INTEGER);
  return {
    durations: data.durations.map(clean),
    distances: data.distances.map(clean),
  };
}

/**
 * Above OSRM_TRIP_MAX_STOPS: get a cheap distance matrix via /table, solve the
 * order locally (lib/routing/solve.ts — nearest-neighbor + 2-opt), then one /route
 * call on the solved order for real turn-by-turn geometry and authoritative totals.
 * The matrix only picks an order; /route's numbers are what the UI actually shows.
 */
export async function requestSolvedRoute(
  stops: { id: string; lat: number; lon: number }[],
  opts: { mode: TravelMode; roundTrip: boolean; fixFirst?: boolean; fixLast?: boolean },
): Promise<OsrmTripResult> {
  // Two sequential demo-server round trips instead of one — bound the total, not
  // just each call, so a slow/stuck demo server still yields the caller's clean
  // 502 instead of the platform's own timeout with no error body.
  const signal = AbortSignal.timeout(8000);
  const table = await requestTable(stops, { mode: opts.mode }, signal);
  const order = solveOrder(table.durations, {
    roundTrip: opts.roundTrip,
    fixFirst: opts.fixFirst,
    fixLast: opts.fixLast,
  });
  const solvedStops = order.map((i) => stops[i]);

  const { route } = await requestRoute(solvedStops, { mode: opts.mode, roundTrip: opts.roundTrip }, signal);
  return {
    order: solvedStops.map((s) => s.id),
    route: { ...route, optimized: true, optimizationMethod: 'heuristic' },
  };
}
