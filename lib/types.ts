/**
 * The spine. Every track codes against these shapes.
 *
 * Two rules that everything else depends on:
 *  1. `Plan.places` array order IS the itinerary order. Nothing else stores order.
 *  2. Import staging lives in `ImportDraft` (localStorage), never in `Plan.places`.
 */

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export type Plan = {
  id: string;
  user_id: string;
  title: string;
  places: Place[];
  route: Route | null;
  schema_version: 1;
  /** Optimistic concurrency. Bumped on every write; a stale value loses. */
  version: number;
  updated_at: string;
};

export type PlaceStatus = 'confirmed' | 'unresolved' | 'manual';

export type Place = {
  id: string;
  /** The exact input line. Never mutated, so a place can always be re-geocoded. */
  raw: string;
  status: PlaceStatus;
  name: string;
  /** null only when status === 'unresolved'. */
  lat: number | null;
  lon: number | null;
  address: string | null;
  osm: OsmRef | null;
  /** e.g. "Q460584" — from Nominatim extratags. */
  wikidata: string | null;
  /** e.g. "en:Fushimi Inari-taisha" — from Nominatim extratags. */
  wikipedia: string | null;
  description: Description | null;
  notes: string | null;
  origin: 'line' | 'prose' | 'manual' | 'map-click';
  addedAt: string;
  /** ISO 3166-1 alpha-2, set at geocode time. Optional/null until every geocoder ladder rung
   * fills it in — only consumed by country grouping (lib/plan/groupByCountry.ts), nothing load-bearing
   * depends on it being present. */
  countryCode?: string | null;
};

export type OsmRef = {
  type: 'node' | 'way' | 'relation';
  id: number;
  /** OSM `class`, e.g. "tourism". Named `class` in the API, renamed here — reserved word. */
  class: string;
  /** OSM `type` within that class, e.g. "museum". */
  tag: string;
};

/**
 * `source` is the ladder rung that produced this text. Instrument its distribution
 * on the first real import — if most cards land on 'osm-tag' the list reads broken.
 */
export type Description = {
  text: string;
  source: 'wikipedia' | 'wikipedia-geosearch' | 'wikidata' | 'osm-tag' | 'user';
  sourceUrl: string | null;
  lang: string | null;
  fetchedAt: string;
};

// ---------------------------------------------------------------------------
// Geocoding
// ---------------------------------------------------------------------------

/**
 * Provider-normalized geocode hit. This is the seam: nothing downstream of
 * /api/geocode learns whether Nominatim or MapTiler answered.
 */
export type Candidate = {
  name: string;
  address: string;
  lat: number;
  lon: number;
  osm: OsmRef | null;
  wikidata: string | null;
  wikipedia: string | null;
  /** 0..1. At or above AUTO_ACCEPT_IMPORTANCE a lone hit is accepted without asking. */
  importance: number;
  class: string;
  tag: string;
};

export const AUTO_ACCEPT_IMPORTANCE = 0.45;

/** OSM classes that can plausibly be a thing you visit. Used to filter prose-scan noise. */
export const PLACE_CLASSES = [
  'tourism',
  'historic',
  'natural',
  'leisure',
  'amenity',
  'place',
] as const;

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export type TravelMode = 'driving' | 'walking' | 'cycling';

/** OSRM /trip's own exact TSP solver caps waypoints here — above this, order-solving
 * switches to the heuristic in lib/routing/solve.ts (nearest-neighbor + 2-opt) instead
 * of refusing. Purely an internal "exact vs heuristic" threshold — never shown to users,
 * see MAX_STOPS_SOLVED for the cap that actually matters to them. */
export const OSRM_TRIP_MAX_STOPS = 12;

/** OSRM's /table endpoint (what the heuristic solver needs for its distance matrix)
 * caps coordinates here — verified live against the public demo server: 100 succeeds,
 * 101 returns {"code":"TooBig"}. Above this, order-solving is refused and the plan
 * routes in whatever order it's already in (today's pre-existing fallback). */
export const MAX_STOPS_SOLVED = 100;

export type Route = {
  version: 1;
  provider: 'osrm';
  mode: TravelMode;
  roundTrip: boolean;
  /** false once the user drags a card — the order is theirs now, not the solver's. */
  optimized: boolean;
  /** How `optimized` was achieved — exact (OSRM /trip) vs heuristic (solve.ts) vs none
   * (left as given). Internal/test value: the UI intentionally renders exact and
   * heuristic identically, users only care whether their order changed. */
  optimizationMethod?: 'exact' | 'heuristic' | 'none';
  /**
   * Stable hash of the place ids in order + mode + roundTrip. Recompute from `places` on
   * render; a mismatch means this route is stale — grey the polyline, offer "Re-route".
   * There is deliberately no `order` array here: order lives only in `Plan.places`.
   */
  orderHash: string;
  legs: RouteLeg[];
  /** Sum of every leg's distanceM — road legs AND direct legs together, since users
   * expect one trip distance. Honest because distanceM is always a real number
   * (road distance or straight-line); see `directLegCount` for the disclosure this
   * implies is needed ("distance includes N direct-line legs with no road route"). */
  totalDistanceM: number;
  /** Sum of ROAD legs' durationS only — a direct leg has no real travel time to add
   * (see RouteLeg.durationS), so this is a partial sum whenever `directLegCount > 0`.
   * Never fabricated from a direct leg's distance. */
  totalDurationS: number;
  /** Stitched across every leg in order — road legs' real shape, direct legs as a
   * straight 2-point segment. Never rendered with the same solid, road-styled
   * treatment as a real route when the trip contains a direct leg — see
   * RouteLeg.geometry and MapView's per-leg rendering. */
  geometry: GeoJsonLineString;
  computedAt: string;
  /** True when this geometry is a zoom-simplified generalization, not turn-by-turn shape
   * (continental-scale trips) — the map/list should say so, never imply it's precise. */
  generalized?: boolean;
  /** Count of legs with no road route (mode: 'direct') — same "don't imply a precision
   * the data doesn't have" contract as `generalized`. When >0, `totalDurationS` is a
   * partial sum and `totalDistanceM` mixes road and straight-line distance; the UI
   * must disclose that (see SummaryBar). */
  directLegCount?: number;
};

export type RouteLeg = {
  fromId: string;
  toId: string;
  /** Always real: road distance for a normal leg, straight-line (haversine) distance
   * for a direct leg — never a penalized/solver-internal cost (see fuseMatrix.ts). */
  distanceM: number;
  /** Undefined for a direct leg — there is no real road travel time to show, and 0
   * would read as instant. Never a fabricated estimate: the whole point of a direct
   * leg is that the app doesn't know how you'd actually cover it. */
  durationS?: number;
  /** Defaults to the route's own `mode` when absent. 'direct' means no road route was
   * found between these two stops — could be a ferry, a flight, or nothing at all; the
   * app deliberately doesn't guess which (see lib/routing/fuseMatrix.ts). */
  mode?: TravelMode | 'direct';
  /** Only present when Route.geometry is no longer a single faithful line for this leg
   * — i.e. the route contains at least one direct leg, so every leg carries its own
   * geometry and MapView must render per-leg instead of one polyline. Road legs get
   * their real (simplified) shape; direct legs get a straight 2-point line. */
  geometry?: GeoJsonLineString;
};

export type GeoJsonLineString = {
  type: 'LineString';
  /** [lon, lat] pairs — GeoJSON order, not lat/lon. */
  coordinates: [number, number][];
};

// ---------------------------------------------------------------------------
// Import draft — staging only. Persisted to localStorage, never to the plans row.
// ---------------------------------------------------------------------------

export type ImportDraft = {
  planId: string;
  sourceKind: 'paste' | 'file';
  rawText: string;
  rows: DraftRow[];
  createdAt: string;
};

export type DraftRowState =
  | 'pending'
  | 'resolving'
  | 'multiple'
  | 'single'
  | 'none'
  | 'error';

export type DraftDecision = 'accept' | 'skip' | 'keep-unresolved';

export type DraftRow = {
  id: string;
  raw: string;
  state: DraftRowState;
  candidates: Candidate[];
  selectedIndex: number | null;
  decision: DraftDecision | null;
  error?: string;
  /**
   * 'prose' rows came from the opt-in free-text scanner and get their candidates
   * filtered to PLACE_CLASSES before anything is shown — see lib/import/classify.ts.
   * 'line' rows are something the user typed on purpose and are never second-guessed
   * by OSM class.
   */
  origin: 'line' | 'prose';
};

/** Cap on rows per import — matches the Nominatim throttle budget, not a UI limit. */
export const MAX_DRAFT_ROWS = 50;

// ---------------------------------------------------------------------------
// API contracts — the four route handlers
// ---------------------------------------------------------------------------

export type GeocodeRequest = { q: string; near?: { lat: number; lon: number } };
export type GeocodeResponse = { candidates: Candidate[] };

/** A named POI from Overpass, not yet annotated with plan-specific context (that's
 * lib/plan/suggest.ts's job — "already added" and detour cost both need `Plan.places`/
 * `Route`, which this stateless endpoint never sees, same seam as Candidate above). */
export type NearbyPoi = {
  name: string;
  lat: number;
  lon: number;
  osm: OsmRef | null;
  class: string;
  tag: string;
};

export type NearbyRequest = {
  /** [lon, lat] pairs — a short corridor (a few legs' worth of stops), never the
   * whole route. See lib/plan/suggest.ts's corridorAroundStop. */
  corridor: [number, number][];
  radiusM: number;
};
export type NearbyResponse = { pois: NearbyPoi[] };

export type DescribeRequest = {
  places: Pick<Place, 'id' | 'name' | 'lat' | 'lon' | 'wikidata' | 'wikipedia' | 'osm'>[];
};
export type DescribeResponse = { descriptions: Record<string, Description | null> };

export type OptimizeRequest = {
  stops: { id: string; lat: number; lon: number }[];
  mode: TravelMode;
  roundTrip: boolean;
  /** Fixed endpoints: keep first/last where they are and only permute the middle. */
  fixFirst?: boolean;
  fixLast?: boolean;
};
export type OptimizeResponse = {
  /** Place ids in solved order. The caller reorders `Plan.places` to match. */
  order: string[];
  route: Omit<Route, 'orderHash'>;
};

export type ParseFileResponse = { text: string; sourceKind: 'file'; filename: string };

/**
 * Localizes an OsrmUnroutableError (lib/routing/osrm.ts) to the one stop responsible
 * — see lib/routing/reachability.ts for how this is derived from a distance matrix.
 *
 * A stop set that merely splits into ≥2 road-connected groups (e.g. mainland vs. an
 * island chain, or Kuala Lumpur / Jakarta) is no longer an error at all — that's now
 * a normal trip shape, routed with direct legs across the gaps (see fuseMatrix.ts).
 * The one case that stays an error is a stop cut off from literally EVERYTHING
 * (both directions, against every other stop) — usually an unsnappable coordinate
 * (a pin in open ocean, a bad geocode), which drawing a direct line can't fix because
 * the pin itself is the problem, not the road network.
 */
export type UnreachableDiagnosis = {
  stopId: string;
};

/** Every route handler returns this shape on failure. */
export type ApiError = { error: string; retryAfterMs?: number; unreachable?: UnreachableDiagnosis };
