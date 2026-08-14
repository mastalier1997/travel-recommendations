import type { Candidate, OsmRef } from '@/lib/types';

const NOMINATIM_URL = process.env.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org';

/**
 * Shape of one element of Nominatim's `format=jsonv2` array response.
 * Confirmed against a live request on the public instance: the top-level OSM class
 * field is named `category` (not `class`, as older Nominatim docs describe — the
 * public instance runs a newer version that renamed it). `type` is unchanged.
 */
export type NominatimResult = {
  osm_type?: string;
  osm_id?: number;
  lat: string;
  lon: string;
  category: string;
  type: string;
  importance?: number;
  name?: string;
  display_name: string;
  extratags?: { wikidata?: string; wikipedia?: string } | null;
};

/**
 * Nominatim's usage policy caps this at 1 req/s and requires an identifying
 * User-Agent with real contact info — an anonymous default UA gets silently
 * throttled or blocked. The 1 req/s side is enforced by lib/geo/gate.ts, one layer
 * up; this function only shapes the request and the response.
 */
export async function searchNominatim(
  query: string,
  near?: { lat: number; lon: number },
): Promise<Candidate[]> {
  const url = new URL('/search', NOMINATIM_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('extratags', '1');
  url.searchParams.set('addressdetails', '0');
  url.searchParams.set('limit', '5');
  // English-first product; without this, a query in a non-English-speaking region
  // returns the local-script name (confirmed live: an unbiased Kyoto query came
  // back as "清水寺", not "Kiyomizu-dera"). Nominatim falls back to local name if
  // no English name exists, so this never produces an empty result.
  url.searchParams.set('accept-language', 'en');
  if (near) {
    // A viewbox without bounded=1 biases toward the area without excluding a real
    // match just outside it — a ~2° box is roughly the scale of a metro region.
    const span = 2;
    url.searchParams.set(
      'viewbox',
      `${near.lon - span},${near.lat + span},${near.lon + span},${near.lat - span}`,
    );
  }

  const contact = process.env.NOMINATIM_CONTACT ?? 'no-contact-configured';
  const res = await fetch(url, {
    headers: { 'User-Agent': `Wanderlist/1 (${contact})` },
  });
  if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);

  const results = (await res.json()) as NominatimResult[];
  return results.map(toCandidate);
}

export function toCandidate(r: NominatimResult): Candidate {
  return {
    name: r.name?.trim() || r.display_name.split(',')[0].trim(),
    address: r.display_name,
    lat: Number(r.lat),
    lon: Number(r.lon),
    osm: toOsmRef(r),
    wikidata: r.extratags?.wikidata ?? null,
    wikipedia: r.extratags?.wikipedia ?? null,
    importance: r.importance ?? 0,
    class: r.category,
    tag: r.type,
  };
}

function toOsmRef(r: NominatimResult): OsmRef | null {
  if (!isOsmType(r.osm_type) || r.osm_id == null) return null;
  return { type: r.osm_type, id: r.osm_id, class: r.category, tag: r.type };
}

function isOsmType(v: unknown): v is OsmRef['type'] {
  return v === 'node' || v === 'way' || v === 'relation';
}
