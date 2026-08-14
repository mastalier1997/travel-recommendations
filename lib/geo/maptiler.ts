import type { Candidate, OsmRef } from '@/lib/types';

const BASE_URL = 'https://api.maptiler.com/geocoding';

/**
 * MapTiler's Geocoding API is Mapbox-compatible GeoJSON: a FeatureCollection whose
 * features carry `text`/`place_name`/`center` plus a `properties` bag. Unlike
 * Nominatim it has no documented `importance` field — `relevance` (0..1) is the
 * closest analogue — and OSM class/tag/wikidata are not guaranteed present.
 *
 * NOT verified against a live key: this environment has no MAPTILER_KEY and no
 * paid account to test with. Built from the public Mapbox-geocoding-compatible
 * contract MapTiler documents; confirm field names against a real response before
 * relying on this in production, particularly `properties.osm_id`/`osm_type`.
 */
type MapTilerFeature = {
  text?: string;
  place_name: string;
  center?: [number, number];
  geometry?: { coordinates?: [number, number] };
  relevance?: number;
  place_type?: string[];
  properties?: {
    osm_id?: number;
    osm_type?: string;
    categories?: string[];
  };
};

type MapTilerResponse = { features: MapTilerFeature[] };

export async function searchMapTiler(
  query: string,
  near?: { lat: number; lon: number },
): Promise<Candidate[]> {
  const key = process.env.MAPTILER_KEY;
  if (!key) throw new Error('MAPTILER_KEY is not set');

  const url = new URL(`${BASE_URL}/${encodeURIComponent(query)}.json`);
  url.searchParams.set('key', key);
  url.searchParams.set('limit', '5');
  if (near) url.searchParams.set('proximity', `${near.lon},${near.lat}`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`MapTiler responded ${res.status}`);

  const { features } = (await res.json()) as MapTilerResponse;
  return features.map(toCandidate).filter((c): c is Candidate => c !== null);
}

export function toCandidate(f: MapTilerFeature): Candidate | null {
  const coords = f.center ?? f.geometry?.coordinates;
  if (!coords) return null;
  const [lon, lat] = coords;

  const category = f.properties?.categories?.[0] ?? f.place_type?.[0] ?? 'place';

  return {
    name: f.text?.trim() || f.place_name.split(',')[0].trim(),
    address: f.place_name,
    lat,
    lon,
    osm: toOsmRef(f, category),
    // No Wikidata/Wikipedia signal from this provider — Track E's description
    // ladder has three more rungs after extratags, so this is a lost first guess,
    // not a broken card.
    wikidata: null,
    wikipedia: null,
    importance: f.relevance ?? 0,
    class: category,
    tag: category,
  };
}

function toOsmRef(f: MapTilerFeature, category: string): OsmRef | null {
  const type = f.properties?.osm_type;
  const id = f.properties?.osm_id;
  if (!isOsmType(type) || id == null) return null;
  return { type, id, class: category, tag: category };
}

function isOsmType(v: unknown): v is OsmRef['type'] {
  return v === 'node' || v === 'way' || v === 'relation';
}
