export type BasemapLayerIds = { boundaryLayerIds: string[]; cityLabelLayerIds: string[] };

const EMPTY: BasemapLayerIds = { boundaryLayerIds: [], cityLabelLayerIds: [] };

/**
 * Layer ids to toggle for the continental-scale map treatment (country borders,
 * city-label suppression), per basemap style URL. Deliberately NOT a bundled
 * admin-0 GeoJSON (500KB+ shipped to every client) — this uses the basemap's own
 * vector layers instead, toggled with setLayoutProperty.
 *
 * Only the keyless OpenFreeMap `liberty` style (the actual default with no
 * MAPTILER_KEY configured) is populated here, verified against its live style.json
 * (`boundary_2` = admin-level-2/country lines; `label_city`/`label_city_capital`/
 * `label_town` = the labels the design wants suppressed below zoom 6). MapTiler's
 * styles are not included — without a key to fetch and inspect their real style
 * JSON, guessing layer ids would ship unverified data presented as fact. Every
 * caller MUST guard with map.getLayer(id) regardless: an unrecognized style (or a
 * MapTiler style, today) falls through to EMPTY, and the feature is then silently
 * absent — same degrade contract as lib/map/mapTheme.ts's resolveMapTheme.
 */
const BY_STYLE: Record<string, BasemapLayerIds> = {
  'https://tiles.openfreemap.org/styles/liberty': {
    boundaryLayerIds: ['boundary_2'],
    cityLabelLayerIds: ['label_city', 'label_city_capital', 'label_town'],
  },
};

export function basemapLayerIds(styleUrl: string): BasemapLayerIds {
  return BY_STYLE[styleUrl] ?? EMPTY;
}
