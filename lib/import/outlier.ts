import { haversineDistance } from '@/lib/routing/haversine';

/** Matches the mockup's own example ("470 km away") — far enough that it's very
 * unlikely to be the place someone meant when the rest of an import batch is
 * clustered somewhere else entirely. */
export const OUTLIER_DISTANCE_M = 300_000;

/**
 * Distance from `point` to the nearest of `others`, in meters — null with no
 * others to compare against. This flow never receives the existing plan's places
 * (ImportFlow only gets `existingPlaceCount`, a number, to avoid threading the
 * whole plan through the import route), so "far from" means far from the rest of
 * THIS import batch, not the trip as a whole.
 */
export function nearestDistanceM(
  point: { lat: number; lon: number },
  others: { lat: number; lon: number }[],
): number | null {
  if (others.length === 0) return null;
  return Math.min(...others.map((p) => haversineDistance(point, p)));
}
