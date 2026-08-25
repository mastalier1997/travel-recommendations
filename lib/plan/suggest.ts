import type { NearbyPoi, Place, Route } from '@/lib/types';
import type { Point } from '@/lib/geo/simplify';
import { haversineDistance } from '@/lib/routing/haversine';
import { estimateDetourMinutes } from '@/lib/routing/detour';

const DEFAULT_LEG_WINDOW = 2;
const ALREADY_ADDED_RADIUS_M = 75;

export type StopSuggestion = NearbyPoi & {
  /** Stable key for the option — an OSM ref when we have one, else a coordinate hash. */
  id: string;
  detourMinutes: number | null;
  alreadyAdded: boolean;
};

/**
 * A short corridor of confirmed-place coordinates around an anchor stop — up to
 * `legWindow` stops before and after it, in itinerary order. Scopes the Overpass
 * query to a bounded area instead of the whole trip, which would time out or
 * return a country's worth of noise on a continental-scale route. Deliberately a
 * straight-line approximation between confirmed stops, not the road-following
 * route geometry — `Route.geometry` has no per-leg boundaries to slice by, and at
 * the radii this feature searches (a few km), the approximation is close enough.
 */
export function corridorAroundStop(
  places: Place[],
  anchorId: string | null,
  legWindow = DEFAULT_LEG_WINDOW,
): Point[] {
  const confirmed = places.filter(
    (p): p is Place & { lat: number; lon: number } => p.lat !== null && p.lon !== null,
  );
  if (confirmed.length === 0) return [];

  const anchorIndex = anchorId ? confirmed.findIndex((p) => p.id === anchorId) : -1;
  const center = anchorIndex === -1 ? confirmed.length - 1 : anchorIndex;

  const start = Math.max(0, center - legWindow);
  const end = Math.min(confirmed.length - 1, center + legWindow);
  return confirmed.slice(start, end + 1).map((p) => [p.lon, p.lat] as Point);
}

/** Annotates raw Overpass POIs with plan-specific context the stateless /api/nearby
 * endpoint never sees: whether it's already a stop on this plan, and a haversine
 * detour estimate against the current route. */
export function buildSuggestions(pois: NearbyPoi[], places: Place[], route: Route | null): StopSuggestion[] {
  return pois.map((poi) => ({
    ...poi,
    id: poi.osm ? `${poi.osm.type}:${poi.osm.id}` : `${poi.name}:${poi.lat}:${poi.lon}`,
    detourMinutes: estimateDetourMinutes(poi, places, route)?.minutes ?? null,
    alreadyAdded: isAlreadyAdded(poi, places),
  }));
}

function isAlreadyAdded(poi: NearbyPoi, places: Place[]): boolean {
  return places.some((p) => {
    if (p.osm && poi.osm && p.osm.type === poi.osm.type && p.osm.id === poi.osm.id) return true;
    if (p.lat === null || p.lon === null) return false;
    return haversineDistance({ lat: p.lat, lon: p.lon }, poi) <= ALREADY_ADDED_RADIUS_M;
  });
}
