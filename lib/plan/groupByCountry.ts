import type { Place, Route, RouteLeg } from '@/lib/types';

/**
 * Continental-scale trips group the list by country with sticky headers and
 * per-country subtotals (2B). Grouping is purely a run-length split on
 * `Place.countryCode` in itinerary order — there is no separate "grouped"
 * state to keep in sync with `places`.
 */
export type CountryGroup = {
  countryCode: string | null;
  /** Region display name via Intl, or 'Unknown' when countryCode is unset. */
  countryLabel: string;
  places: Place[];
  /** Index of this group's first place in the flat `places` array — for
   * itinerary ordinals ("Stop 3 of 23") and jump-to-country targets. */
  startIndex: number;
  /** The leg crossing INTO this group, from the previous group's last place. Null for the first group. */
  entryLeg: RouteLeg | null;
  /** Legs strictly within this group (places.length - 1 of them, chained in order). */
  legs: RouteLeg[];
  distanceM: number;
  /** Sum of this group's ROAD legs' durationS only — see `hasDirectLeg`. */
  durationS: number;
  /** True when the entry leg or any leg within this group has no road route
   * (mode: 'direct') — so `durationS` above is a partial sum, and any UI showing
   * it must say so, same "don't imply a precision the data doesn't have" contract
   * Route.directLegCount carries at the whole-trip level. */
  hasDirectLeg: boolean;
};

/** Stable key for one group — shared by the sidebar (jump chips, sticky headers)
 * and the map (cluster badges), so both sides of the UI agree on group identity. */
export function groupKey(g: Pick<CountryGroup, 'countryCode' | 'startIndex'>): string {
  return `${g.countryCode ?? 'unknown'}-${g.startIndex}`;
}

export function groupByCountry(places: Place[], route: Route | null): CountryGroup[] {
  const legByFromId = new Map((route?.legs ?? []).map((leg) => [leg.fromId, leg] as const));
  const groups: CountryGroup[] = [];

  places.forEach((place, i) => {
    const code = place.countryCode ?? null;
    const prevPlace = i > 0 ? places[i - 1] : null;
    const leg = prevPlace ? (legByFromId.get(prevPlace.id) ?? null) : null;
    const last = groups[groups.length - 1];

    if (last && last.countryCode === code) {
      if (leg) {
        last.legs.push(leg);
        last.distanceM += leg.distanceM;
        // A direct leg's durationS is undefined (no real road time) — skip it
        // rather than let it silently zero out, and flag the group as partial.
        if (leg.durationS != null) last.durationS += leg.durationS;
        if (leg.mode === 'direct') last.hasDirectLeg = true;
      }
      last.places.push(place);
      return;
    }

    groups.push({
      countryCode: code,
      countryLabel: countryLabel(code),
      places: [place],
      startIndex: i,
      entryLeg: leg,
      legs: [],
      distanceM: 0,
      durationS: 0,
      hasDirectLeg: leg?.mode === 'direct',
    });
  });

  return groups;
}

function countryLabel(code: string | null): string {
  if (!code) return 'Unknown';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
