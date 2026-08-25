/**
 * Straight-line distance matrix — the MOCK-mode stand-in for OSRM's /table, so
 * `/api/optimize` can exercise the real solver (lib/routing/solve.ts) with zero
 * network. Not real driving distance, just close enough to give the solver
 * something meaningful to work with in dev/fixture previews.
 */

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineDistance(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function haversineMatrix(stops: { lat: number; lon: number }[]): number[][] {
  const n = stops.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 0 : haversineDistance(stops[i], stops[j]))),
  );
}
