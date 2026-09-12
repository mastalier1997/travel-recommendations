import type { Route, RouteLeg, TravelMode, UnreachableDiagnosis } from '@/lib/types';
import { solveOrder } from './solve';
import { diagnoseUnreachable } from './reachability';
import { fuseMatrix } from './fuseMatrix';
import { splitIntoRuns } from './runs';
import { haversineDistance } from './haversine';

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
    if (!(err instanceof OsrmUnroutableError)) throw err;
    // /trip never fetches a distance matrix of its own (unlike requestSolvedRoute
    // below), so it can't tell a genuine road gap (now routed with direct legs)
    // from a truly unsnappable stop. One bounded /table call resolves that — and
    // since it's being paid for anyway, it feeds the same gap-tolerant pipeline
    // instead of being purely cosmetic. Any failure here (timeout, TooBig, another
    // OsrmUnroutableError with no diagnosis) propagates as a plain error — never
    // silently worse than the /trip failure that got us here.
    const signal = AbortSignal.timeout(5000);
    const table = await requestTable(stops, { mode: opts.mode }, signal);
    return solveAndRouteFromTable(stops, table, opts, signal);
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
 * order locally (lib/routing/solve.ts — nearest-neighbor + 2-opt), then route the
 * solved order — across any road gaps the matrix found — for real turn-by-turn
 * geometry and authoritative totals. The matrix only picks an order; the /route
 * call(s) in solveAndRouteFromTable are what the UI actually shows numbers from.
 */
export async function requestSolvedRoute(
  stops: { id: string; lat: number; lon: number }[],
  opts: { mode: TravelMode; roundTrip: boolean; fixFirst?: boolean; fixLast?: boolean },
): Promise<OsrmTripResult> {
  // Bound the total across every call this ends up making (the /table plus
  // however many /route calls solveAndRouteFromTable needs) — not just each one —
  // so a slow/stuck demo server still yields the caller's clean 502 instead of the
  // platform's own timeout with no error body.
  const signal = AbortSignal.timeout(8000);
  const table = await requestTable(stops, { mode: opts.mode }, signal);
  return solveAndRouteFromTable(stops, table, opts, signal);
}

/** At most this many /route calls total per solveAndRouteFromTable /
 * requestRouteWithGaps invocation (across every run plus every bisection retry) —
 * bounds both latency (against the shared AbortSignal budget) and load on the
 * public OSRM demo server's rate limits. Tunable. */
const MAX_ROUTE_CALLS = 8;

/**
 * Shared by the exact tier's /trip fallback and the heuristic tier: given a
 * distance matrix (already fetched), fuse in straight-line estimates for any road
 * gap (fuseMatrix.ts), solve an order over the fused matrix, then route that order
 * — routing each gap-free run with its own /route call and connecting gap
 * boundaries with a direct leg, rather than one all-or-nothing call across
 * everything. The one exception that still 422s: a stop cut off from literally
 * everything (diagnoseUnreachable's 'isolated' case) — direct-lining that would
 * hide what's actually a bad coordinate, not a real geographic gap.
 */
export async function solveAndRouteFromTable(
  stops: { id: string; lat: number; lon: number }[],
  table: OsrmTableResult,
  opts: { mode: TravelMode; roundTrip: boolean; fixFirst?: boolean; fixLast?: boolean },
  signal: AbortSignal,
): Promise<OsrmTripResult> {
  const stopIds = stops.map((s) => s.id);
  const diagnosis = diagnoseUnreachable(stopIds, table.unreachable);
  if (diagnosis) throw new OsrmUnroutableError('Unreachable stop found via /table', diagnosis);

  const fused = fuseMatrix(table.durations, table.unreachable, stops);
  const orderIdx = solveOrder(fused.solveDurations, {
    roundTrip: opts.roundTrip,
    fixFirst: opts.fixFirst,
    fixLast: opts.fixLast,
  });
  const solvedStops = orderIdx.map((i) => stops[i]);

  const gapBetween = (i: number, j: number) => table.unreachable[i][j] && table.unreachable[j][i];
  const budget = { remaining: MAX_ROUTE_CALLS };
  const runs = splitIntoRuns(solvedStops.length, (k) => gapBetween(orderIdx[k], orderIdx[k + 1]));

  let legs: RouteLeg[] = [];
  let coordinates: [number, number][] = [];

  for (let r = 0; r < runs.length; r++) {
    const positions = runs[r];
    const runStops = positions.map((p) => solvedStops[p]);
    const span = await routeSpan(runStops, opts.mode, signal, budget);
    legs = [...legs, ...span.legs];
    coordinates = mergeCoordinates(coordinates, span.coordinates);

    if (r < runs.length - 1) {
      const aPos = positions[positions.length - 1];
      const bPos = runs[r + 1][0];
      const a = solvedStops[aPos];
      const b = solvedStops[bPos];
      const gapLeg = buildDirectLeg(a, b, fused.gapDistances[orderIdx[aPos]][orderIdx[bPos]]);
      legs = [...legs, gapLeg];
      coordinates = mergeCoordinates(coordinates, gapLeg.geometry!.coordinates);
    }
  }

  if (opts.roundTrip && solvedStops.length > 1) {
    const last = solvedStops[solvedStops.length - 1];
    const first = solvedStops[0];
    if (gapBetween(orderIdx[orderIdx.length - 1], orderIdx[0])) {
      const gapLeg = buildDirectLeg(last, first, fused.gapDistances[orderIdx[orderIdx.length - 1]][orderIdx[0]]);
      legs = [...legs, gapLeg];
      coordinates = mergeCoordinates(coordinates, gapLeg.geometry!.coordinates);
    } else {
      const closing = await routeSpan([last, first], opts.mode, signal, budget);
      legs = [...legs, ...closing.legs];
      coordinates = mergeCoordinates(coordinates, closing.coordinates);
    }
  }

  return {
    order: solvedStops.map((s) => s.id),
    route: buildRoute(opts, legs, coordinates, true, 'heuristic'),
  };
}

/**
 * Above MAX_STOPS_SOLVED: no /table (its own cap is 100 coordinates), so no
 * upfront gap knowledge — order is given, not solved, same as today. Purely
 * reactive: try the whole sequence as one /route call, bisect-and-retry on
 * failure, degrade to a direct leg on final failure or budget exhaustion.
 */
export async function requestRouteWithGaps(
  stops: { id: string; lat: number; lon: number }[],
  opts: { mode: TravelMode; roundTrip: boolean },
  signal: AbortSignal,
): Promise<OsrmTripResult> {
  const budget = { remaining: MAX_ROUTE_CALLS };
  let { legs, coordinates } = await routeSpan(stops, opts.mode, signal, budget);

  if (opts.roundTrip && stops.length > 1) {
    const closing = await routeSpan([stops[stops.length - 1], stops[0]], opts.mode, signal, budget);
    legs = [...legs, ...closing.legs];
    coordinates = mergeCoordinates(coordinates, closing.coordinates);
  }

  return {
    order: stops.map((s) => s.id),
    route: buildRoute(opts, legs, coordinates, false, 'none'),
  };
}

function buildRoute(
  opts: { mode: TravelMode; roundTrip: boolean },
  legs: RouteLeg[],
  coordinates: [number, number][],
  optimized: boolean,
  optimizationMethod: 'heuristic' | 'none',
): Omit<Route, 'orderHash'> {
  const directLegCount = legs.filter((l) => l.mode === 'direct').length;
  // Per-leg geometry only earns its keep when there's a gap to route around —
  // Route.geometry alone is the whole story otherwise, same payload as before
  // this feature existed.
  const finalLegs = directLegCount > 0 ? legs : legs.map(stripLegGeometry);
  return {
    version: 1,
    provider: 'osrm',
    mode: opts.mode,
    roundTrip: opts.roundTrip,
    optimized,
    optimizationMethod,
    legs: finalLegs,
    totalDistanceM: legs.reduce((sum, l) => sum + l.distanceM, 0),
    // Road legs only — a direct leg has no real travel time to add (see
    // RouteLeg.durationS), so this is deliberately a partial sum whenever
    // directLegCount > 0, never a fabricated estimate.
    totalDurationS: legs.reduce((sum, l) => sum + (l.durationS ?? 0), 0),
    geometry: { type: 'LineString', coordinates },
    computedAt: new Date().toISOString(),
    directLegCount: directLegCount || undefined,
  };
}

function stripLegGeometry(leg: RouteLeg): RouteLeg {
  if (!leg.geometry) return leg;
  const { geometry: _drop, ...rest } = leg;
  return rest;
}

type Span = { legs: RouteLeg[]; coordinates: [number, number][] };

/**
 * Routes one contiguous run of stops with a single /route call when the budget
 * allows; on OsrmUnroutableError (the mask said this run should be fully
 * connected, but /route disagrees — weak/symmetrized connectivity can be wrong)
 * bisects into two overlapping halves and retries each, bottoming out at a
 * single degraded direct leg for a pair that still won't route, or once the call
 * budget is exhausted. A successful call's geometry is attached to its own first
 * leg (buildRoute strips it back off if the overall result ends up gap-free).
 */
async function routeSpan(
  spanStops: { id: string; lat: number; lon: number }[],
  mode: TravelMode,
  signal: AbortSignal,
  budget: { remaining: number },
): Promise<Span> {
  if (spanStops.length < 2) {
    return { legs: [], coordinates: spanStops.length === 1 ? [[spanStops[0].lon, spanStops[0].lat]] : [] };
  }

  if (budget.remaining > 0) {
    budget.remaining--;
    try {
      const { route } = await requestRoute(spanStops, { mode, roundTrip: false }, signal);
      const legs = route.legs.map((leg, i) => (i === 0 ? { ...leg, geometry: route.geometry } : leg));
      return { legs, coordinates: route.geometry.coordinates };
    } catch (err) {
      if (!(err instanceof OsrmUnroutableError)) throw err;
      // Fall through to bisect (or degrade, at the 2-stop base case) below.
    }
  }

  if (spanStops.length === 2) {
    const leg = buildDirectLeg(spanStops[0], spanStops[1]);
    return { legs: [leg], coordinates: leg.geometry!.coordinates };
  }

  const mid = Math.floor(spanStops.length / 2);
  const left = await routeSpan(spanStops.slice(0, mid + 1), mode, signal, budget);
  const right = await routeSpan(spanStops.slice(mid), mode, signal, budget);
  return { legs: [...left.legs, ...right.legs], coordinates: mergeCoordinates(left.coordinates, right.coordinates) };
}

function buildDirectLeg(
  a: { id: string; lat: number; lon: number },
  b: { id: string; lat: number; lon: number },
  // Callers that already know the gap distance (fuseMatrix.ts's gapDistances, for
  // a gap the /table matrix predicted) pass it explicitly, so this and the
  // solver's cost estimate can never silently drift apart. routeSpan's own
  // reactive degrade — a mask/reality disagreement the matrix didn't predict —
  // has no precomputed value to pass, so it falls back to computing it here.
  distanceM: number = haversineDistance(a, b),
): RouteLeg {
  return {
    fromId: a.id,
    toId: b.id,
    distanceM,
    mode: 'direct',
    geometry: { type: 'LineString', coordinates: [[a.lon, a.lat], [b.lon, b.lat]] },
  };
}

/** Concatenates two coordinate runs, dropping a duplicate point at the seam
 * (common when one run's real endpoint is another's real or synthetic start). */
function mergeCoordinates(a: [number, number][], b: [number, number][]): [number, number][] {
  if (a.length === 0) return [...b];
  if (b.length === 0) return [...a];
  const last = a[a.length - 1];
  const first = b[0];
  const dedupe = last[0] === first[0] && last[1] === first[1];
  return [...a, ...(dedupe ? b.slice(1) : b)];
}
