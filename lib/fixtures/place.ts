import type { Place } from '@/lib/types';

/**
 * Shared by every fixture plan. Builds the full default `Place` first and spreads
 * `p` over it — never `as Place` — so adding a required field to `Place` breaks the
 * build here instead of letting a fixture silently ship an invalid object.
 */
export function place(
  p: Partial<Place> & Pick<Place, 'id' | 'name' | 'lat' | 'lon' | 'addedAt'>,
): Place {
  const base: Place = {
    id: p.id,
    raw: p.name,
    status: 'confirmed',
    name: p.name,
    lat: p.lat,
    lon: p.lon,
    address: null,
    osm: null,
    wikidata: null,
    wikipedia: null,
    description: null,
    notes: null,
    origin: 'line',
    addedAt: p.addedAt,
  };
  return { ...base, ...p };
}
