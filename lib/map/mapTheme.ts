export type MapTheme = 'light' | 'dark';

/**
 * MapLibre paint properties are JS, not CSS, so they can't read the
 * prefers-color-scheme vars in globals.css directly. These are the same
 * values, duplicated here on purpose — keep them paired with their
 * app/globals.css counterpart (noted per entry) when either changes.
 */
export const MAP_COLORS: Record<
  MapTheme,
  { routeCasing: string; routeLine: string; routeStale: string; direct: string }
> = {
  light: {
    routeCasing: '#ffffff', // --background (Graphite light)
    routeLine: '#6656c8', // --primary
    routeStale: '#8b949e', // --input
    direct: '#2f7fc9', // --chart-2, a distinct blue so a no-road-route leg never reads as a driving one — matches --direct-line
  },
  dark: {
    routeCasing: '#0c0f12', // --background (Graphite dark), near-black casing per the dark-mode polarity flip
    routeLine: '#9084da', // --primary
    routeStale: '#5d6872', // --input
    direct: '#5596dc', // --chart-2
  },
};

/**
 * OpenFreeMap's keyless `liberty` style has no dark variant, so the dark UI theme
 * (system-driven or manually toggled, from lib/hooks/useTheme.ts) without a MapTiler
 * key stays on the light basemap and light route polarity rather than mismatching a
 * dark UI against a light map.
 */
export function resolveMapTheme(uiTheme: MapTheme, hasMapTilerKey: boolean): MapTheme {
  return uiTheme === 'dark' && hasMapTilerKey ? 'dark' : 'light';
}

export function mapStyleUrl(theme: MapTheme, key: string | undefined): string {
  if (!key) return 'https://tiles.openfreemap.org/styles/liberty';
  return theme === 'dark'
    ? `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${key}`
    : `https://api.maptiler.com/maps/landscape/style.json?key=${key}`;
}
