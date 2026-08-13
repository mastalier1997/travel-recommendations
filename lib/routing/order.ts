import type { Place, Route, TravelMode } from '@/lib/types';

/**
 * ponytail: FNV-1a, not sha1. This is a staleness marker, not a security boundary —
 * a collision costs one unnecessary re-route. Being synchronous is what matters:
 * it runs on every render on the client, where crypto.subtle is async-only.
 */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function orderHash(
  places: Pick<Place, 'id'>[],
  mode: TravelMode,
  roundTrip: boolean,
): string {
  return fnv1a(`${mode}|${roundTrip ? 'rt' : 'ow'}|${places.map((p) => p.id).join(',')}`);
}

/**
 * True when the drawn polyline no longer matches the list. Callers grey the route
 * and offer "Re-route". A plan with no route is not stale — there is nothing to redraw.
 */
export function isRouteStale(places: Pick<Place, 'id'>[], route: Route | null): boolean {
  if (!route) return false;
  return orderHash(places, route.mode, route.roundTrip) !== route.orderHash;
}
