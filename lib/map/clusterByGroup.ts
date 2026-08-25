import type { Place } from '@/lib/types';
import { groupKey, type CountryGroup } from '@/lib/plan/groupByCountry';
import type { ZoomBand } from './zoomBand';

/** A group collapses into one badge once it has at least this many resolved stops
 * and the zoom band says the map is zoomed out enough to need it. */
const CLUSTER_MIN_COUNT = 3;

export type MapMarkerItem =
  | { kind: 'pin'; placeId: string; lat: number; lon: number }
  | { kind: 'cluster'; key: string; countryLabel: string; count: number; lat: number; lon: number };

/**
 * Groups by itinerary order and country (groupByCountry's own grouping), never by
 * raw geographic proximity — MapLibre's native `cluster:true` GeoJSON source was
 * rejected for this reason: it would merge two separate visits to the same country
 * into one blob regardless of when in the trip they happen, and its cluster ids
 * aren't stable across zoom, so there'd be nothing durable to give a text
 * equivalent to. A small or close-up group renders as ordinary numbered pins —
 * nothing to cluster.
 */
export function clusterByGroup(groups: CountryGroup[], band: ZoomBand): MapMarkerItem[] {
  return groups.flatMap((g): MapMarkerItem[] => {
    const pts = g.places.filter(hasCoords);
    if (pts.length === 0) return [];

    if (band === 'close' || pts.length < CLUSTER_MIN_COUNT) {
      return pts.map((p) => ({ kind: 'pin', placeId: p.id, lat: p.lat, lon: p.lon }));
    }

    return [
      {
        kind: 'cluster',
        key: groupKey(g),
        countryLabel: g.countryLabel,
        count: pts.length,
        lat: average(pts.map((p) => p.lat)),
        lon: average(pts.map((p) => p.lon)),
      },
    ];
  });
}

function hasCoords(p: Place): p is Place & { lat: number; lon: number } {
  return p.lat !== null && p.lon !== null;
}

function average(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0) / ns.length;
}
