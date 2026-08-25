/**
 * Ramer–Douglas–Peucker line simplification. Shared by the Overpass corridor query
 * (downsample a route to a small vertex count before sending it as a query filter)
 * and continental-scale route geometry (Route.generalized — a turn-by-turn OSRM
 * trace for a 23-stop trip is thousands of points, too dense to be worth rendering
 * or shipping to the client at that zoom).
 */

export type Point = [number, number]; // [lon, lat] — GeoJSON coordinate order

/** `tolerance` is in the same units as the input coordinates (degrees, for lon/lat) —
 * the perpendicular distance from the chord below which a point is dropped. */
export function simplifyLine(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  rdp(points, 0, points.length - 1, tolerance, keep);
  return points.filter((_, i) => keep[i]);
}

function rdp(points: Point[], start: number, end: number, tolerance: number, keep: Uint8Array): void {
  let maxDist = 0;
  let maxIndex = -1;
  for (let i = start + 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[start], points[end]);
    if (d > maxDist) {
      maxDist = d;
      maxIndex = i;
    }
  }
  if (maxIndex !== -1 && maxDist > tolerance) {
    keep[maxIndex] = 1;
    rdp(points, start, maxIndex, tolerance, keep);
    rdp(points, maxIndex, end, tolerance, keep);
  }
}

function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Simplify down to at most `maxPoints`, growing tolerance geometrically until the
 * cap is met. Bounded iteration count — for the input sizes this ever sees
 * (a route's own geometry, or a corridor built from a handful of legs). */
export function simplifyToMaxPoints(points: Point[], maxPoints: number, startTolerance = 0.001): Point[] {
  if (points.length <= maxPoints) return points;
  let tolerance = startTolerance;
  let result = points;
  for (let i = 0; i < 20 && result.length > maxPoints; i++) {
    result = simplifyLine(points, tolerance);
    tolerance *= 1.8;
  }
  return result;
}
