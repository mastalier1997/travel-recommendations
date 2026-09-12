import type { Route, RouteLeg, TravelMode, UnreachableDiagnosis } from '@/lib/types';
import { solveOrder } from './solve';
import { diagnoseUnreachable } from './reachability';

const OSRM_URL = process.env.OSRM_URL ?? 'https://router.project-osrm.org';

/** Thrown when OSRM successfully answered but says no trip/route is possible between
 * the given stops — a fact about the road network (e.g. two islands with no ferry
 * connection in OSRM's graph, like Kuala Lumpur to Bali by "driving"), not a service
 * failure. Callers can catch this to give a specific, actionable message instead of
 * the generic "couldn't reach the routing service". `diagnosis`, when present, names
 * which stop(s) — see lib/routing/reachability.ts. */
export class OsrmUnroutableError extends Error {
  diagnosis?: UnreachableDiagnosis;
  constructor(message: string, diagnosis?: UnreachableDiagnosis) {
    super(message);
    this.diagnosis = diagnosis;
  }
}

/** "No route/trip possible" codes across /trip, /route, and /table. Only 'NoTrips' is
 * confirmed live against the public demo server (as a non-2xx HTTP status, not a 200
 * with a logical failure code) — for a Kuala Lumpur -> Bali "driving" request, no
 * road/ferry connection exists in OSRM's graph. 'NoTrip', 'NoRoute', and 'NoSegment'
 * (an unsnappable coordinate — the same underlying failure regardless of endpoint)
 * are OSRM's documented equivalents for the other endpoints, not independently
 * verified here; if OSRM's real behavior for those ever differs, this is the set to
 * revisit. */
const UNROUTABLE_CODES = new Set(['NoTrips', 'NoTrip', 'NoRoute', 'NoSegment']);

function osrmCode(body: string): string | null {
  try {
    return (JSON.parse(body) as { code?: string }).code ?? null;
  } catch {
    return null;
  }
}

/** OSRM's error responses are small JSON bodies ({"code":...,"message":...}) that
 * name the actual problem (e.g. "TooBig", "NotImplemented", "NoTrips") — worth
 * surfacing in the thrown error instead of just the bare HTTP status, so a
 * production failure says what actually went wrong instead of just that something did. */
export async function throwOnError(res: Response, endpoint: string): Promise<void> {
  if (res.ok) return;
  const body = await res.text().catch(() => '');
  const code = osrmCode(body);
  if (code && UNROUTABLE_CODES.has(code)) throw new OsrmUnroutableError(`OSRM /${endpoint}: ${code}`);
  throw new Error(`OSRM /${endpoint} responded ${res.status}: ${body.slice(0, 300)}`);
}

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

  try {
    const res = await fetch(url);
    await throwOnError(res, 'trip');
    const data = (await res.json()) as OsrmTripResponse;
    return toTripResult(stops, data, opts);
  } catch (err) {
    // /trip never fetches a distance matrix (unlike requestSolvedRoute below), so
    // OSRM's failure code alone can't say WHICH stop is unroutable. Worth one extra,
    // bounded /table call here — and only here — to localize it for the 422 message.
    if (err instanceof OsrmUnroutableError && !err.diagnosis) {
      err.diagnosis = await diagnoseViaTable(stops, opts.mode);
    }
    throw err;
  }
}

/** Best-effort localization for the exact tier, which has no matrix of its own.
 * Must never turn a clean 422 into something worse: any failure here (timeout,
 * TooBig, another OsrmUnroutableError) is swallowed — the caller falls back to
 * today's un-diagnosed message. Purely cosmetic, never load-bearing. */
async function diagnoseViaTable(
  stops: { id: string; lat: number; lon: number }[],
  mode: TravelMode,
): Promise<UnreachableDiagnosis | undefined> {
  try {
    const table = await requestTable(stops, { mode }, AbortSignal.timeout(5000));
    return diagnoseUnreachable(stops.map((s) => s.id), table.unreachable) ?? undefined;
  } catch {
    return undefined;
  }
}

export function toTripResult(
  stops: { id: string; lat: number; lon: number }[],
  data: OsrmTripResponse,
  opts: { mode: TravelMode; roundTrip: boolean },
): OsrmTripResult {
  // Empirically this demo server delivers "no trip possible" as a non-2xx status
  // (see throwOnError), but a 200 with a failure code is still handled defensively —
  // surface that instead of indexing into undefined either way.
  if (data.code !== 'Ok' || !data.trips?.[0] || !data.waypoints) {
    if (UNROUTABLE_CODES.has(data.code)) throw new OsrmUnroutableError(`OSRM /trip: ${data.code}`);
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
  await throwOnError(res, 'route');
  const data = (await res.json()) as OsrmRouteResponse;
  return toRouteResult(stops, data, opts);
}

export function toRouteResult(
  stops: { id: string; lat: number; lon: number }[],
  data: OsrmRouteResponse,
  opts: { mode: TravelMode; roundTrip: boolean },
): OsrmTripResult {
  if (data.code !== 'Ok' || !data.routes?.[0]) {
    if (UNROUTABLE_CODES.has(data.code)) throw new OsrmUnroutableError(`OSRM /route: ${data.code}`);
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

export type OsrmTableResult = {
  durations: number[][];
  distances: number[][];
  /** `[i][j] === true` where OSRM returned null for that pair — kept alongside the
   * MAX_SAFE_INTEGER-substituted durations/distances (below) instead of being
   * discarded, so requestSolvedRoute can diagnose a genuine disconnection instead
   * of just failing on the /route call it would otherwise waste. */
  unreachable: boolean[][];
};

export async function requestTable(
  stops: { id: string; lat: number; lon: number }[],
  opts: { mode: TravelMode },
  signal?: AbortSignal,
): Promise<OsrmTableResult> {
  const coords = stops.map((s) => `${s.lon},${s.lat}`).join(';');
  const url = new URL(`/table/v1/${opts.mode}/${coords}`, OSRM_URL);
  url.searchParams.set('annotations', 'duration,distance');

  const res = await fetch(url, { signal });
  await throwOnError(res, 'table');
  const data = (await res.json()) as OsrmTableResponse;
  return toTableResult(data);
}

export function toTableResult(data: OsrmTableResponse): OsrmTableResult {
  if (data.code !== 'Ok' || !data.durations || !data.distances) {
    if (UNROUTABLE_CODES.has(data.code)) throw new OsrmUnroutableError(`OSRM /table: ${data.code}`);
    throw new Error(`OSRM table failed: ${data.code}`);
  }
  // A pair OSRM can't route between at all comes back null — treat it as "very
  // far" so the solver's comparisons stay well-defined instead of NaN-poisoning.
  const clean = (row: (number | null)[]) => row.map((v) => v ?? Number.MAX_SAFE_INTEGER);
  return {
    durations: data.durations.map(clean),
    distances: data.distances.map(clean),
    unreachable: data.durations.map((row) => row.map((v) => v == null)),
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

  // The matrix already proves a genuine disconnection here — no need to spend the
  // /route call finding that out the slow way. (Fail-fast only: /table's null cells
  // are exactly what /route would fail on too, so this can't reject a trip /route
  // would otherwise have solved.)
  const diagnosis = diagnoseUnreachable(stops.map((s) => s.id), table.unreachable);
  if (diagnosis) throw new OsrmUnroutableError('Unreachable stop(s) found via /table', diagnosis);

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
