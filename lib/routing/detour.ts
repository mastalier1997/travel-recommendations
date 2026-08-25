import type { Place, Route } from '@/lib/types';
import { haversineDistance } from './haversine';

const ASSUMED_KMH = 40; // city/regional default when the nearest leg has no timing of its own

export type DetourEstimate = { minutes: number; afterPlaceId: string; beforePlaceId: string };

/**
 * Cheapest-insertion detour estimate for adding `candidate` between two adjacent
 * confirmed stops, using haversine distance rather than a live OSRM call — this
 * runs against a whole batch of nearby-suggestion candidates as the user types, and
 * an OSRM round trip per candidate isn't viable at that rate (see lib/plan/suggest.ts).
 * Meters convert to minutes using the chosen leg's own distanceM/durationS ratio, so
 * a motorway leg and a city leg each calibrate the estimate to their own real speed
 * instead of one flat assumption.
 */
export function estimateDetourMinutes(
  candidate: { lat: number; lon: number },
  places: Place[],
  route: Route | null,
): DetourEstimate | null {
  const confirmed = places.filter(
    (p): p is Place & { lat: number; lon: number } => p.lat !== null && p.lon !== null,
  );
  if (confirmed.length < 2) return null;

  const legByFromId = new Map((route?.legs ?? []).map((leg) => [leg.fromId, leg]));
  let best: DetourEstimate | null = null;
  let bestExtraM = Infinity;

  for (let i = 0; i < confirmed.length - 1; i++) {
    const a = confirmed[i];
    const b = confirmed[i + 1];
    const direct = haversineDistance(a, b);
    const viaCandidate = haversineDistance(a, candidate) + haversineDistance(candidate, b);
    const extraM = viaCandidate - direct;
    if (extraM < bestExtraM) {
      bestExtraM = extraM;
      const leg = legByFromId.get(a.id);
      const metersPerSecond =
        leg && leg.distanceM > 0 && leg.durationS > 0 ? leg.distanceM / leg.durationS : (ASSUMED_KMH * 1000) / 3600;
      best = {
        minutes: Math.max(0, Math.round(extraM / metersPerSecond / 60)),
        afterPlaceId: a.id,
        beforePlaceId: b.id,
      };
    }
  }
  return best;
}
