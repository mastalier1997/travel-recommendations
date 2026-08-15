export type MapTheme = 'light' | 'dark';

/**
 * MapLibre paint properties are JS, not CSS, so they can't read the
 * prefers-color-scheme vars in globals.css directly. These are the same
 * values, duplicated here on purpose — keep them paired with their
 * app/globals.css counterpart (noted per entry) when either changes.
 */
export const MAP_COLORS: Record<
  MapTheme,
  { routeCasing: string; routeLine: string; routeStale: string; ferry: string }
> = {
  light: {
    routeCasing: '#ffffff', // --surface
    routeLine: '#c2643f', // --accent
    routeStale: '#9a9288', // --border-control
    ferry: '#3f7c8c', // distinct teal so a non-driving leg never reads as a driving one
  },
  dark: {
    routeCasing: '#17150f', // --bg, near-black casing per the design's dark-mode polarity flip
    routeLine: '#f08a52', // --accent
    routeStale: '#787268', // --border-control
    ferry: '#6fb3c2',
  },
};

/**
 * OpenFreeMap's keyless `liberty` style has no dark variant, so a system dark
 * preference without a MapTiler key stays on the light basemap and light
 * route polarity rather than mismatching a dark UI against a light map.
 */
export function resolveMapTheme(prefersDark: boolean, hasMapTilerKey: boolean): MapTheme {
  return prefersDark && hasMapTilerKey ? 'dark' : 'light';
}

export function mapStyleUrl(theme: MapTheme, key: string | undefined): string {
  if (!key) return 'https://tiles.openfreemap.org/styles/liberty';
  return theme === 'dark'
    ? `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${key}`
    : `https://api.maptiler.com/maps/landscape/style.json?key=${key}`;
}
