export type GeoProvider = 'nominatim' | 'maptiler';

/**
 * MAPTILER_KEY present → maptiler (the production default; no 1 req/s throttle,
 * so it also skips the Postgres rate gate). Otherwise nominatim — free, no key,
 * but subject to the throttle. GEOCODER forces either one explicitly, e.g. to
 * exercise the nominatim path even with a MapTiler key configured.
 */
export function activeProvider(): GeoProvider {
  const forced = process.env.GEOCODER;
  if (forced === 'nominatim' || forced === 'maptiler') return forced;
  return process.env.MAPTILER_KEY ? 'maptiler' : 'nominatim';
}
