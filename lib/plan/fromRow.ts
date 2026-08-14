import type { Place, Plan, Route } from '@/lib/types';

/**
 * Normalize a `plans` row into a Plan.
 *
 * `places` and `route` are jsonb, so the database will happily hand back anything
 * that was ever written — including documents from an older shape. This is the one
 * place that deals with it, so no component has to guard against a missing field.
 */
export function planFromRow(row: Record<string, unknown>): Plan {
  const places = Array.isArray(row.places) ? row.places.filter(isPlaceish).map(normalizePlace) : [];

  return {
    id: String(row.id ?? ''),
    user_id: String(row.user_id ?? ''),
    title: typeof row.title === 'string' && row.title.trim() ? row.title : 'Untitled plan',
    places,
    route: normalizeRoute(row.route, places),
    schema_version: 1,
    version: typeof row.version === 'number' ? row.version : 1,
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

function isPlaceish(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string';
}

function normalizePlace(p: Record<string, unknown>): Place {
  const lat = typeof p.lat === 'number' ? p.lat : null;
  const lon = typeof p.lon === 'number' ? p.lon : null;
  const raw = typeof p.raw === 'string' ? p.raw : String(p.name ?? '');

  return {
    id: String(p.id),
    raw,
    // A place without coordinates is unresolved whatever the stored status claims —
    // otherwise it reaches the map and the router as a confirmed stop with no position.
    status: lat === null || lon === null ? 'unresolved' : (p.status as Place['status']) ?? 'confirmed',
    name: typeof p.name === 'string' && p.name ? p.name : raw,
    lat,
    lon,
    address: typeof p.address === 'string' ? p.address : null,
    osm: (p.osm as Place['osm']) ?? null,
    wikidata: typeof p.wikidata === 'string' ? p.wikidata : null,
    wikipedia: typeof p.wikipedia === 'string' ? p.wikipedia : null,
    description: (p.description as Place['description']) ?? null,
    notes: typeof p.notes === 'string' ? p.notes : null,
    origin: (p.origin as Place['origin']) ?? 'manual',
    addedAt: typeof p.addedAt === 'string' ? p.addedAt : new Date().toISOString(),
  };
}

function normalizeRoute(value: unknown, places: Place[]): Route | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;

  const geometry = r.geometry as Route['geometry'] | undefined;
  if (!geometry || !Array.isArray(geometry.coordinates)) return null;

  const known = new Set(places.map((p) => p.id));
  const legs = Array.isArray(r.legs)
    ? (r.legs as Route['legs']).filter((l) => known.has(l.fromId) && known.has(l.toId))
    : [];

  return {
    version: 1,
    provider: 'osrm',
    mode: (r.mode as Route['mode']) ?? 'driving',
    roundTrip: Boolean(r.roundTrip),
    optimized: Boolean(r.optimized),
    // Deliberately preserved as stored. If it no longer matches the places array,
    // isRouteStale reports the route as stale — which is the correct outcome.
    orderHash: String(r.orderHash ?? ''),
    legs,
    totalDistanceM: typeof r.totalDistanceM === 'number' ? r.totalDistanceM : 0,
    totalDurationS: typeof r.totalDurationS === 'number' ? r.totalDurationS : 0,
    geometry,
    computedAt: String(r.computedAt ?? new Date().toISOString()),
  };
}
