import type { Place } from '@/lib/types';
import { groupKey, type CountryGroup } from '@/lib/plan/groupByCountry';
import { pixelDistance, lonLatCentroid } from './mercator';

/** Screen-pixel radius, measured from a run's anchor stop, within which the next
 * stop merges into the same badge. Derived from the pin's own footprint (26px
 * --pin-size, plus a 2px ring and 1px outline) with enough headroom that two
 * rendered markers are never closer than WCAG 2.5.8's 24px target-spacing floor —
 * so clustering and legible target spacing fall out of the same one number. */
const CLUSTER_RADIUS_PX = 40;

export type MapMarkerItem =
  | { kind: 'pin'; placeId: string; lat: number; lon: number }
  | {
      kind: 'cluster';
      key: string;
      label: string;
      count: number;
      memberIds: string[];
      lat: number;
      lon: number;
    };

/**
 * Clusters stops by actual on-screen distance at the current zoom, never by a flat
 * zoom-band cutoff or a bare stop count — a country group whose stops are actually
 * hundreds of km apart (e.g. Jakarta to Bali) must stay as separate markers even
 * when zoomed out, and two stops a few km apart must merge as soon as their pins
 * would visually overlap. `groupByCountry`'s grouping is kept as a hard outer
 * boundary (never merge across it) so cluster identity stays anchored to the
 * sidebar's own country sections; this only adds an inner geographic pass.
 *
 * Within a group, a run extends from an anchor stop while the NEXT stop is within
 * CLUSTER_RADIUS_PX of that anchor — not of the previous stop. A previous-relative
 * rule lets a chain of small gaps span the whole screen (the exact bug this
 * replaces, in a new shape); anchor-relative bounds every run to a fixed diameter.
 *
 * `selectedStopId` is never absorbed into a run — it always renders as its own pin,
 * so selecting a stop from the sidebar never highlights a marker that doesn't exist.
 */
export function clusterByGroup(
  groups: CountryGroup[],
  zoom: number,
  selectedStopId: string | null = null,
): MapMarkerItem[] {
  return groups.flatMap((g) => clusterOneGroup(g, zoom, selectedStopId));
}

function clusterOneGroup(g: CountryGroup, zoom: number, selectedStopId: string | null): MapMarkerItem[] {
  const resolved = resolvedWithOrdinal(g);
  const items: MapMarkerItem[] = [];

  let i = 0;
  while (i < resolved.length) {
    const anchor = resolved[i];
    if (anchor.place.id === selectedStopId) {
      items.push(pin(anchor.place));
      i += 1;
      continue;
    }

    let j = i + 1;
    while (
      j < resolved.length &&
      resolved[j].place.id !== selectedStopId &&
      pixelDistance(anchor.place, resolved[j].place, zoom) <= CLUSTER_RADIUS_PX
    ) {
      j += 1;
    }

    const run = resolved.slice(i, j);
    items.push(run.length === 1 ? pin(run[0].place) : cluster(g, run));
    i = j;
  }

  return items;
}

function pin(p: Place & { lat: number; lon: number }): MapMarkerItem {
  return { kind: 'pin', placeId: p.id, lat: p.lat, lon: p.lon };
}

function cluster(g: CountryGroup, run: { place: Place & { lat: number; lon: number }; ordinal: number }[]): MapMarkerItem {
  const first = run[0].ordinal;
  const last = run[run.length - 1].ordinal;
  // An unresolved (no-coordinate) stop can sit between two clustered resolved ones,
  // breaking ordinal contiguity — "Stops 1–3" would then imply 3 stops for a badge
  // whose count/memberIds only has 2. Fall back to a plain count rather than a range
  // that overstates what's actually in the badge.
  const span = last - first + 1 === run.length ? `Stops ${first}–${last}` : `${run.length} stops`;
  const label = g.countryCode ? `${span} · ${g.countryLabel}` : span;
  const { lon, lat } = lonLatCentroid(run.map((r) => r.place));

  return {
    kind: 'cluster',
    key: `${groupKey(g)}:${run[0].place.id}`,
    label,
    count: run.length,
    memberIds: run.map((r) => r.place.id),
    lat,
    lon,
  };
}

/** Places with coordinates, paired with their 1-based itinerary ordinal — the same
 * number shown on that stop's own pin/list row — so a cluster's label can honestly
 * say "Stops 4–8" instead of inventing a name that appears nowhere else in the UI. */
function resolvedWithOrdinal(g: CountryGroup): { place: Place & { lat: number; lon: number }; ordinal: number }[] {
  const out: { place: Place & { lat: number; lon: number }; ordinal: number }[] = [];
  g.places.forEach((place, i) => {
    if (place.lat !== null && place.lon !== null) {
      out.push({ place: place as Place & { lat: number; lon: number }, ordinal: g.startIndex + i + 1 });
    }
  });
  return out;
}
