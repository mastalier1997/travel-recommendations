const EARTH_CIRCUMFERENCE_M = 40_075_016.686;
const NICE_STEPS = [1, 2, 5];

/** Meters per pixel at a given zoom/latitude — standard Web Mercator formula
 * (256px tiles). Not MapLibre-specific: pure math, testable with no map instance. */
export function metersPerPixel(zoom: number, latitude: number): number {
  return (EARTH_CIRCUMFERENCE_M * Math.cos((latitude * Math.PI) / 180)) / 2 ** (zoom + 8);
}

export type ScaleBar = { meters: number; widthPx: number; label: string };

/** A round-number scale-bar distance that fits within maxWidthPx — same "nice
 * number" approach as Leaflet's L.Control.Scale, reimplemented here because
 * maplibregl.ScaleControl renders inside the map's aria-hidden canvas subtree and
 * so is invisible to assistive tech; this instead backs a real, readable <p>. */
export function scaleBar(zoom: number, latitude: number, maxWidthPx = 100): ScaleBar {
  const mpp = metersPerPixel(zoom, latitude);
  const maxMeters = mpp * maxWidthPx;
  const magnitude = 10 ** Math.floor(Math.log10(maxMeters));

  let meters = magnitude;
  for (const step of NICE_STEPS) {
    const candidate = step * magnitude;
    if (candidate <= maxMeters) meters = candidate;
  }

  return { meters, widthPx: meters / mpp, label: formatScaleLabel(meters) };
}

function formatScaleLabel(meters: number): string {
  return meters >= 1000 ? `${Math.round(meters / 1000)} km` : `${Math.round(meters)} m`;
}
