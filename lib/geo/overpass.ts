import type { NearbyPoi } from '@/lib/types';
import { PLACE_CLASSES } from '@/lib/types';
import type { Point } from './simplify';

const OVERPASS_URL = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';

/** Mirrors lib/plan/suggest.ts's leg-window corridor (at most a handful of
 * points) — anything longer means either a caller bypassing that scoping or a
 * bug, either way not something to hand to Overpass. */
export const MAX_CORRIDOR_POINTS = 12;
/** Matches the "a few km around the route" scope this feature is meant to have —
 * well short of Overpass's own server-side query-size limits, but large enough
 * that a bad radius can't turn one request into a country-sized query. */
export const MAX_RADIUS_M = 15_000;

/**
 * `corridor`/`radiusM` reach buildQuery() as raw numbers spliced into Overpass QL
 * (see there) — unlike lib/geo/nominatim.ts's URLSearchParams-encoded query, that
 * string isn't escaped, so anything that isn't actually a finite in-range number
 * must be rejected here before it ever reaches the query string.
 */
export function validateNearbyRequest(
  corridor: unknown,
  radiusM: unknown,
): { corridor: Point[]; radiusM: number } | null {
  if (!Array.isArray(corridor) || corridor.length === 0 || corridor.length > MAX_CORRIDOR_POINTS) return null;
  if (!corridor.every(isValidPoint)) return null;
  if (typeof radiusM !== 'number' || !Number.isFinite(radiusM) || radiusM <= 0 || radiusM > MAX_RADIUS_M) return null;
  return { corridor: corridor as Point[], radiusM };
}

function isValidPoint(p: unknown): p is Point {
  return (
    Array.isArray(p) &&
    p.length === 2 &&
    typeof p[0] === 'number' &&
    typeof p[1] === 'number' &&
    Number.isFinite(p[0]) &&
    Number.isFinite(p[1]) &&
    p[0] >= -180 &&
    p[0] <= 180 &&
    p[1] >= -90 &&
    p[1] <= 90
  );
}

/**
 * Named POIs within `radiusM` of the given corridor. Overpass's `around` filter
 * buffers the *whole* polyline in one query, so this is one request per search,
 * not one per corridor point — see lib/plan/suggest.ts for why the corridor is
 * kept short (a few legs, never the whole route).
 */
export async function searchOverpass(corridor: Point[], radiusM: number): Promise<NearbyPoi[]> {
  if (corridor.length === 0) return [];

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(buildQuery(corridor, radiusM))}`,
  });
  if (!res.ok) throw new Error(`Overpass responded ${res.status}`);

  const data = (await res.json()) as OverpassResponse;
  return toPois(data);
}

export function buildQuery(corridor: Point[], radiusM: number): string {
  const around = corridor.map(([lon, lat]) => `${lat},${lon}`).join(',');
  const filters = PLACE_CLASSES.map((cls) => `  node(around:${radiusM},${around})[${cls}];`).join('\n');
  return `[out:json][timeout:25];\n(\n${filters}\n);\nout body 60;`;
}

type OverpassResponse = {
  elements: { type: string; id: number; lat: number; lon: number; tags?: Record<string, string> }[];
};

export function toPois(data: OverpassResponse): NearbyPoi[] {
  const seen = new Set<number>();
  const pois: NearbyPoi[] = [];
  for (const el of data.elements ?? []) {
    // Unnamed nodes (a bench, a bin tagged amenity=waste_basket) aren't a place
    // anyone would search for or recognize as a suggestion.
    if (el.type !== 'node' || seen.has(el.id) || !el.tags?.name) continue;
    const classified = classifyTags(el.tags);
    if (!classified) continue;
    seen.add(el.id);
    pois.push({
      name: el.tags.name,
      lat: el.lat,
      lon: el.lon,
      osm: { type: 'node', id: el.id, class: classified.class, tag: classified.tag },
      class: classified.class,
      tag: classified.tag,
    });
  }
  return pois;
}

function classifyTags(tags: Record<string, string>): { class: string; tag: string } | null {
  for (const cls of PLACE_CLASSES) {
    if (tags[cls]) return { class: cls, tag: tags[cls] };
  }
  return null;
}
