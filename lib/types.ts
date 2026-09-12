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
  totalDistanceM: number;
  totalDurationS: number;
  geometry: GeoJsonLineString;
  computedAt: string;
  /** True when this geometry is a zoom-simplified generalization, not turn-by-turn shape
   * (continental-scale trips) — the map/list should say so, never imply it's precise. */
  generalized?: boolean;
};

export type RouteLeg = {
  fromId: string;
  toId: string;
  distanceM: number;
  durationS: number;
  /** Defaults to the route's own `mode` when absent. Set per-leg for a non-driving
   * segment (e.g. a ferry) that the road-network mode can't represent. */
  mode?: TravelMode | 'ferry';
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
 * Localizes an OsrmUnroutableError (lib/routing/osrm.ts) to specific stop ids —
 * see lib/routing/reachability.ts for how this is derived from a distance matrix.
 */
export type UnreachableDiagnosis = {
  /** 'isolated': one stop cut off from every other stop (both directions) — usually
   * an unsnappable pin. 'split': the stop set breaks into ≥2 road-connected groups
   * (e.g. mainland vs. an island chain) — no single stop is "the" problem. */
  kind: 'isolated' | 'split';
  /** True only for 'isolated'. A 'split' never names one side with certainty — even
   * a 2-stop split is symmetric, so blaming one stop over the other would be a guess. */
  confident: boolean;
  /** Suggested-to-address ids: the isolated stop, or the union of every non-largest group. */
  stopIds: string[];
  /** Full partition, largest group first. Present for 'split' only. */
  groups?: string[][];
};

/** Every route handler returns this shape on failure. */
export type ApiError = { error: string; retryAfterMs?: number; unreachable?: UnreachableDiagnosis };
