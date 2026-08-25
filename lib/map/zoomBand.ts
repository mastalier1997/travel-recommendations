export type ZoomBand = 'close' | 'regional' | 'continental';

/**
 * Coarse zoom classification driving the continental-scale map treatment: city
 * labels, clustering, and the basemap badge all key off this instead of each
 * picking their own threshold. Thresholds are tuned for a driving trip, not a
 * general-purpose map: 9+ is city/metro scale, 5-9 is a country or a few, below
 * 5 is genuinely continental.
 */
export function zoomBand(zoom: number): ZoomBand {
  if (zoom >= 9) return 'close';
  if (zoom >= 5) return 'regional';
  return 'continental';
}
