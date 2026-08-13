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

/** OSRM /trip caps waypoints. Above this the UI must refuse and say why. */
export const MAX_STOPS_PER_ROUTE = 12;

export type Route = {
  version: 1;
  provider: 'osrm';
  mode: TravelMode;
  roundTrip: boolean;
  /** false once the user drags a card — the order is theirs now, not the solver's. */
  optimized: boolean;
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
};

export type RouteLeg = {
  fromId: string;
  toId: string;
  distanceM: number;
  durationS: number;
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
};

// ---------------------------------------------------------------------------
// API contracts — the four route handlers
// ---------------------------------------------------------------------------

export type GeocodeRequest = { q: string; near?: { lat: number; lon: number } };
export type GeocodeResponse = { candidates: Candidate[] };

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

/** Every route handler returns this shape on failure. */
export type ApiError = { error: string; retryAfterMs?: number };
