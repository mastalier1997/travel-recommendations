const TILE_SIZE = 256;
const MAX_LATITUDE = 85.05113;

/**
 * Web Mercator pixel projection at a given zoom — the actual on-screen distance
 * primitive, unlike scale.ts's metersPerPixel (ground distance, latitude-corrected,
 * right for the scale bar but the wrong unit for "would these two pins overlap").
 * Latitude is clamped to Web Mercator's own valid range, same as every slippy map.
 */
export function projectPx(lon: number, lat: number, zoom: number): { x: number; y: number } {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const clampedLat = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat));
  const sinLat = Math.sin((clampedLat * Math.PI) / 180);
  const x = (worldSize * (lon + 180)) / 360;
  const y = (worldSize / 2) * (1 - Math.log((1 + sinLat) / (1 - sinLat)) / (2 * Math.PI));
  return { x, y };
}

/** Shortest signed delta between two world-space x coordinates, wrapping across
 * the antimeridian instead of taking the long way round the globe. */
export function unwrapDx(dx: number, worldSize: number): number {
  let d = dx % worldSize;
  if (d > worldSize / 2) d -= worldSize;
  if (d < -worldSize / 2) d += worldSize;
  return d;
}

/** On-screen pixel distance between two lon/lat points at a given zoom. */
export function pixelDistance(
  a: { lon: number; lat: number },
  b: { lon: number; lat: number },
  zoom: number,
): number {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const pa = projectPx(a.lon, a.lat, zoom);
  const pb = projectPx(b.lon, b.lat, zoom);
  const dx = unwrapDx(pb.x - pa.x, worldSize);
  const dy = pb.y - pa.y;
  return Math.hypot(dx, dy);
}

/** Antimeridian-safe centroid: unwrap each point's longitude relative to the
 * first, average in that unwrapped space, then wrap the result back to [-180, 180). */
export function lonLatCentroid(points: { lon: number; lat: number }[]): { lon: number; lat: number } {
  const [first, ...rest] = points;
  let lonSum = first.lon;
  let latSum = first.lat;
  for (const p of rest) {
    let d = p.lon - first.lon;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    lonSum += first.lon + d;
    latSum += p.lat;
  }
  const lon = ((lonSum / points.length + 540) % 360) - 180;
  return { lon, lat: latSum / points.length };
}
