'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { type LngLatBoundsLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Place, Route } from '@/lib/types';
import { useResolvedTheme } from '@/lib/hooks/useTheme';
import { MAP_COLORS, mapStyleUrl, resolveMapTheme } from '@/lib/map/mapTheme';
import { groupByCountry } from '@/lib/plan/groupByCountry';
import { clusterByGroup } from '@/lib/map/clusterByGroup';
import { scaleBar } from '@/lib/map/scale';
import { basemapLayerIds } from '@/lib/map/basemapLayers';
import styles from './planner.module.css';

/** Below this, individual city/town labels are dropped in favor of the country
 * context the continental-scale treatment adds instead — matches the design's own
 * "city labels hidden below zoom 6" wording exactly, so it's a fixed threshold. */
const CITY_LABEL_MIN_ZOOM = 6;

/** Marker clustering (lib/map/clusterByGroup.ts) recomputes on every zoom tick;
 * rounding to quarter-zoom steps stops trivial mouse-wheel jitter from thrashing
 * marker DOM on every 'moveend' without meaningfully changing what clusters. */
const ZOOM_MEMO_STEP = 0.25;
const quantizeZoom = (z: number) => Math.round(z / ZOOM_MEMO_STEP) * ZOOM_MEMO_STEP;

/** Single source of truth for the map's starting view — used both to construct
 * the maplibregl.Map and to seed the mapZoom/centerLat state that drives
 * clustering/labels/scale before the first 'moveend' fires. */
const INIT_VIEW = { center: [135.7, 34.9] as [number, number], zoom: 8 };

// No key needed: OpenFreeMap's public instance is keyless and unmetered, so it's
// a safe default rather than a blank background. Swap in MAPTILER_KEY for nicer
// styling if you have one.
// TODO: OpenFreeMap has no uptime/SLA guarantee — if this ships to real users,
// move to MapTiler (or self-host OpenFreeMap) for a reliability backstop.
const KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

type Props = {
  places: Place[];
  route: Route | null;
  /** Route is drawn greyed when the list order has moved on from it. */
  routeStale: boolean;
  selectedStopId: string | null;
  onSelectStop: (id: string) => void;
  reducedMotion: boolean;
  /** True while a card is being dragged — the map must stop competing for the gesture. */
  interactionLocked?: boolean;
};

export function MapView({
  places,
  route,
  routeStale,
  selectedStopId,
  onSelectStop,
  reducedMotion,
  interactionLocked,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef(new Map<string, maplibregl.Marker>());
  // Latest callback without re-creating markers on every parent render.
  const onSelectRef = useRef(onSelectStop);
  onSelectRef.current = onSelectStop;

  const uiTheme = useResolvedTheme();
  const mapTheme = resolveMapTheme(uiTheme, Boolean(KEY));
  const styleUrl = mapStyleUrl(mapTheme, KEY);
  const appliedStyleRef = useRef(styleUrl);
  // Reattaching the route layers is route-effect's job; style.load (fired on
  // init AND on every setStyle) just needs to call whatever that latest logic is.
  const applyRouteRef = useRef<() => void>(() => {});
  // Same pattern for the continental-scale basemap toggles (borders, city labels) —
  // a setStyle wipes layout-property overrides same as it wipes the route source.
  const applyBasemapRef = useRef<() => void>(() => {});

  const [mapZoom, setMapZoom] = useState(INIT_VIEW.zoom);
  const [centerLat, setCenterLat] = useState(INIT_VIEW.center[1]);
  const groups = useMemo(() => groupByCountry(places, route), [places, route]);
  const grouped = groups.length > 1;
  const clusterZoom = quantizeZoom(mapZoom);
  const markerItems = useMemo(
    () => clusterByGroup(groups, clusterZoom, selectedStopId),
    [groups, clusterZoom, selectedStopId],
  );
  const placeIndexById = useMemo(() => new Map(places.map((p, i) => [p.id, i])), [places]);
  // Latest places without re-running the init effect — the resize/refit fix below
  // needs them, but must stay mount-only so it shares maplibre's own map instance.
  const placesRef = useRef(places);
  placesRef.current = places;

  // --- fit to all stops on first paint ------------------------------------
  // Hoisted above the init effect (which reads fittedRef/refitOnceRef) — the ref
  // objects are stable across renders regardless of declaration order, but this
  // keeps the resize workaround's dependency readable top-to-bottom.
  const fittedRef = useRef(false);
  const refitOnceRef = useRef(false);

  // --- init ---------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: appliedStyleRef.current,
      center: INIT_VIEW.center,
      zoom: INIT_VIEW.zoom,
      // Own controls live outside the aria-hidden subtree; the canvas itself must not
      // be a tab stop or a keyboard target.
      attributionControl: false,
      keyboard: false,
    });
    mapRef.current = map;

    map.getCanvas().setAttribute('aria-hidden', 'true');
    map.getCanvas().tabIndex = -1;
    map.on('style.load', () => {
      applyRouteRef.current();
      applyBasemapRef.current();
    });
    map.on('moveend', () => {
      setMapZoom(map.getZoom());
      setCenterLat(map.getCenter().lat);
    });

    // Production-only bug: on a first-ever client-side navigation into a route
    // whose CSS chunk hasn't applied yet, .mapWrap can still be 0-height at the
    // instant this effect runs. MapLibre has its own internal ResizeObserver, but
    // it deliberately discards that FIRST delivery as redundant with construction —
    // so if 0 -> real size happens within that one delivery, MapLibre never learns
    // the container changed, and the canvas is stuck at its 300px fallback until
    // something else (a manual refresh) forces a fresh mount. This second,
    // independent observer doesn't discard anything, so it catches exactly that case.
    //
    // Seeded from the container's actual size right now (not a hardcoded 0,0) so an
    // already-fine load's own first delivery isn't mistaken for a real change.
    // MapLibre's own fallback for an unmeasurable container is a hardcoded 300px —
    // well below that is "this container hasn't been laid out yet", not a real size.
    const DEGENERATE_HEIGHT_PX = 50;
    const initialRect = containerRef.current.getBoundingClientRect();
    let lastW = initialRect.width;
    let lastH = initialRect.height;
    const ro = new ResizeObserver(([entry]) => {
      if (!mapRef.current) return;
      const { width, height } = entry.contentRect;
      if (width === lastW && height === lastH) return;
      const grewOutOfDegenerateHeight = lastH < DEGENERATE_HEIGHT_PX && height >= DEGENERATE_HEIGHT_PX;
      lastW = width;
      lastH = height;
      map.resize();
      // Test-only hook, dead code in production: this exact race (a resize
      // MapLibre's own observer would discard as its "first" delivery) is
      // impractical to force deterministically from outside the page in an
      // e2e test — the timing depends on React's mount instant. This counter
      // lets a dev-fixture test confirm THIS code path specifically ran,
      // rather than only that the canvas eventually looks right (which
      // MapLibre's own observer already achieves on its own for any
      // non-first delivery, so a size-only assertion can't tell them apart).
      if (process.env.NODE_ENV !== 'production') {
        const w = window as unknown as { __mapResizeObserverFired?: number };
        w.__mapResizeObserverFired = (w.__mapResizeObserverFired ?? 0) + 1;
      }
      // fitBounds (the "fit to all stops on first paint" effect below) computes
      // its camera against whatever size the container had at that moment. If it
      // ran against a degenerate (e.g. 0px-tall) size, resize() alone fixes the
      // canvas but leaves the camera fitted to the wrong aspect ratio — redo the
      // fit exactly once to correct it. Gated on actually recovering FROM a
      // degenerate height (not just "any resize after the first fit"), so an
      // ordinary later window resize never re-fights the user's own panning/zooming.
      if (grewOutOfDegenerateHeight && fittedRef.current && !refitOnceRef.current) {
        refitOnceRef.current = true;
        const pts = placesRef.current.filter((p) => p.lat !== null && p.lon !== null);
        if (pts.length) fitTo(map, pts, true);
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // --- restyle on theme change ---------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedStyleRef.current === styleUrl) return;
    appliedStyleRef.current = styleUrl;
    // A different style URL is a full reload: existing sources/layers are gone,
    // but DOM markers survive since they're not part of the MapLibre style.
    map.setStyle(styleUrl);
  }, [styleUrl]);

  // --- route line ---------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const colors = MAP_COLORS[mapTheme];

    const apply = () => {
      // A route with a direct leg (no road route — RouteLeg.mode 'direct') carries
      // per-leg geometry (see lib/routing/osrm.ts's buildRoute) so the solid
      // casing/line layers below only ever draw REAL road shape. Route.geometry
      // alone would draw a straight, solid, road-styled line across the gap —
      // exactly the false claim the dashed overlay exists to avoid making.
      // Common case (no gap): no leg carries geometry, so this is the same single
      // Feature it's always been, zero behavior change.
      const roadLegs = (route?.legs ?? []).filter((leg) => leg.mode !== 'direct' && leg.geometry);
      const data =
        roadLegs.length > 0
          ? {
              type: 'FeatureCollection' as const,
              features: roadLegs.map((leg) => ({
                type: 'Feature' as const,
                properties: {},
                geometry: leg.geometry!,
              })),
            }
          : route
            ? { type: 'Feature' as const, properties: {}, geometry: route.geometry }
            : { type: 'FeatureCollection' as const, features: [] };

      const src = map.getSource('route') as maplibregl.GeoJSONSource | undefined;
      if (src) {
        src.setData(data);
      } else {
        map.addSource('route', { type: 'geojson', data });
        // Casing first. The casing/line pair guarantees the route's shape stays
        // legible over any tile colour — which no single stroke colour can.
        map.addLayer({
          id: 'route-casing',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': colors.routeCasing, 'line-width': 10 },
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': colors.routeLine, 'line-width': 6 },
        });
      }
      if (map.getLayer('route-casing')) {
        map.setPaintProperty('route-casing', 'line-color', colors.routeCasing);
      }
      if (map.getLayer('route-line')) {
        map.setPaintProperty('route-line', 'line-color', routeStale ? colors.routeStale : colors.routeLine);
      }

      // Direct legs (no road route found — could be a ferry, a flight, or nothing
      // at all; the app doesn't guess which) as their own dashed overlay, drawn
      // straight between endpoints since there's no real road geometry to draw in
      // the first place. Never colour-only: the dash pattern is one non-colour
      // channel, the list's leg row text (which spells out "no road route found")
      // is the one that actually carries the fact for anyone who can't see this
      // aria-hidden canvas at all.
      const placeById = new Map(places.map((p) => [p.id, p]));
      const directLegs = (route?.legs ?? []).filter((leg) => leg.mode === 'direct');
      const directData = {
        type: 'FeatureCollection' as const,
        features: directLegs.flatMap((leg) => {
          const from = placeById.get(leg.fromId);
          const to = placeById.get(leg.toId);
          if (from?.lat == null || from?.lon == null || to?.lat == null || to?.lon == null) return [];
          return [
            {
              type: 'Feature' as const,
              properties: {},
              geometry: {
                type: 'LineString' as const,
                coordinates: [
                  [from.lon, from.lat],
                  [to.lon, to.lat],
                ],
              },
            },
          ];
        }),
      };
      const directSrc = map.getSource('route-direct') as maplibregl.GeoJSONSource | undefined;
      if (directSrc) {
        directSrc.setData(directData);
      } else {
        map.addSource('route-direct', { type: 'geojson', data: directData });
        // Same casing/line pairing as the main route, for the same reason —
        // a bare dashed line has no legibility guarantee over an arbitrary tile.
        map.addLayer({
          id: 'route-direct-casing',
          type: 'line',
          source: 'route-direct',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': colors.routeCasing, 'line-width': 8, 'line-dasharray': [2, 2] },
        });
        map.addLayer({
          id: 'route-direct',
          type: 'line',
          source: 'route-direct',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': colors.direct, 'line-width': 4, 'line-dasharray': [2, 2] },
        });
      }
      if (map.getLayer('route-direct-casing')) {
        map.setPaintProperty('route-direct-casing', 'line-color', colors.routeCasing);
      }
      if (map.getLayer('route-direct')) {
        map.setPaintProperty('route-direct', 'line-color', colors.direct);
      }
    };

    // style.load (registered once, at init) reruns whatever apply() this
    // effect last handed it — including across a setStyle triggered by a
    // theme change, when the source/layers above have just been wiped.
    applyRouteRef.current = apply;
    if (map.isStyleLoaded()) apply();
  }, [route, routeStale, mapTheme, places]);

  // --- continental-scale basemap toggles (borders, city labels) ------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const { boundaryLayerIds, cityLabelLayerIds } = basemapLayerIds(styleUrl);

    const apply = () => {
      // Country borders only when a plan actually spans more than one country —
      // for a single-region trip, every stop sharing one border says nothing.
      for (const id of boundaryLayerIds) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', grouped ? 'visible' : 'none');
      }
      for (const id of cityLabelLayerIds) {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', mapZoom >= CITY_LABEL_MIN_ZOOM ? 'visible' : 'none');
        }
      }
    };

    applyBasemapRef.current = apply;
    if (map.isStyleLoaded()) apply();
  }, [styleUrl, grouped, mapZoom]);

  // --- markers --------------------------------------------------------------
  // Rendered from markerItems (lib/map/clusterByGroup), not one-per-place — at a
  // zoomed-out band a dense country group collapses into one cluster badge. Still
  // DOM markers, not a MapLibre symbol layer: they must survive a theme-triggered
  // setStyle the same way the old per-place pins did (see the restyle effect above).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const live = new Set<string>();
    const placeById = new Map(places.map((p) => [p.id, p]));

    markerItems.forEach((item) => {
      const key = item.kind === 'pin' ? item.placeId : `cluster:${item.key}`;
      live.add(key);

      let marker = markersRef.current.get(key);
      if (!marker) {
        const el = document.createElement('div');
        el.className = item.kind === 'pin' ? styles.pin : styles.clusterPin;
        el.dataset.markerKind = item.kind;
        // Pins/badges are a pointer shortcut, nothing more. Order, name, country and
        // count are all real text in the list — a cluster badge adds no new fact
        // that isn't already in that group's sticky heading.
        el.setAttribute('aria-hidden', 'true');
        el.tabIndex = -1;
        marker = new maplibregl.Marker({ element: el }).setLngLat([item.lon, item.lat]).addTo(map);
        markersRef.current.set(key, marker);
      } else {
        marker.setLngLat([item.lon, item.lat]);
      }

      const el = marker.getElement();
      el.onclick = null;
      if (item.kind === 'pin') {
        const place = placeById.get(item.placeId);
        el.textContent = String((placeIndexById.get(item.placeId) ?? 0) + 1);
        el.dataset.unresolved = String(place?.status === 'unresolved');
        el.dataset.selected = String(item.placeId === selectedStopId);
        el.onclick = (e) => {
          e.stopPropagation();
          onSelectRef.current(item.placeId);
        };
      } else {
        el.textContent = item.label;
        el.dataset.selected = 'false';
        el.onclick = (e) => {
          e.stopPropagation();
          // Fit to exactly this badge's own members (never a group-key lookup) so a
          // click always zooms to what's actually represented by the marker clicked.
          // ponytail: no explicit "guarantee de-clustering" zoom math here — fitTo's
          // existing maxZoom:14 cap already separates any two real, non-duplicate
          // stops (40px cluster radius is well under 400m at zoom 14). Revisit only
          // if a report surfaces stops that share near-identical coordinates.
          const pts = item.memberIds.flatMap((id) => placeById.get(id) ?? []);
          if (pts.length) fitTo(map, pts, reducedMotion);
        };
      }
    });

    markersRef.current.forEach((m, key) => {
      if (!live.has(key)) {
        m.remove();
        markersRef.current.delete(key);
      }
    });
  }, [markerItems, places, placeIndexById, selectedStopId, reducedMotion]);

  // --- fit to all stops on first paint ------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fittedRef.current) return;
    const pts = places.filter((p) => p.lat !== null && p.lon !== null);
    if (pts.length === 0) return;
    fittedRef.current = true;
    map.once('load', () => fitTo(map, pts, true));
  }, [places]);

  // --- follow selection ---------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    const p = places.find((x) => x.id === selectedStopId);
    if (!map || !p || p.lat === null || p.lon === null) return;
    const to = { center: [p.lon, p.lat] as [number, number], zoom: Math.max(map.getZoom(), 12) };
    if (reducedMotion) map.jumpTo(to);
    else map.easeTo({ ...to, duration: 600 });
  }, [selectedStopId, places, reducedMotion]);

  // --- gesture arbitration -------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (interactionLocked) {
      map.dragPan.disable();
      map.touchZoomRotate.disable();
    } else {
      map.dragPan.enable();
      map.touchZoomRotate.enable();
    }
  }, [interactionLocked]);

  const zoom = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ zoom: map.getZoom() + delta, duration: reducedMotion ? 0 : 200 });
  };

  const fitAll = () => {
    const map = mapRef.current;
    if (map) fitTo(map, places.filter((p) => p.lat !== null), reducedMotion);
  };

  const scale = scaleBar(mapZoom, centerLat);
  // Only claim borders are on when this style actually has a border layer to show —
  // basemapLayerIds returns [] for anything but the verified OpenFreeMap style (see
  // its module comment), and the toggle effect above is then a silent no-op.
  const showBordersBadge = grouped && basemapLayerIds(styleUrl).boundaryLayerIds.length > 0;
  const hasDirectLeg = (route?.legs ?? []).some((leg) => leg.mode === 'direct');

  return (
    <div className={styles.mapWrap} data-testid="map-wrap">
      <div ref={containerRef} className={styles.mapCanvas} data-testid="map-canvas" aria-hidden="true" />

      {/* Purely visual chrome — decorative like the rest of the map (see the module
          comment on markers above). The facts it restates (country names, whether
          this is a multi-country trip, distance totals) already exist as real text
          in the sidebar, so none of this needs its own accessible equivalent. */}
      {showBordersBadge && (
        <p className={styles.mapBadge} aria-hidden="true">
          Country borders on · city labels hidden below zoom {CITY_LABEL_MIN_ZOOM}
        </p>
      )}

      {hasDirectLeg && (
        <p className={styles.mapBadge} aria-hidden="true">
          Dashed line · direct line, no road route
        </p>
      )}

      <p className={styles.mapScale} aria-hidden="true" style={{ width: `${scale.widthPx}px` }}>
        {scale.label}
      </p>

      {/* Controls and attribution sit outside the aria-hidden subtree on purpose. */}
      <div className={styles.mapControls}>
        <button type="button" onClick={() => zoom(1)} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => zoom(-1)} aria-label="Zoom out">
          −
        </button>
        <button type="button" className={styles.fitAllButton} onClick={fitAll}>
          Fit whole trip
        </button>
      </div>

      <p className={styles.attribution}>
        {KEY ? (
          <>
            © <a href="https://www.maptiler.com/copyright/">MapTiler</a> ©{' '}
            <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors
          </>
        ) : (
          <>
            © <a href="https://openfreemap.org">OpenFreeMap</a> ©{' '}
            <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors
          </>
        )}
      </p>
    </div>
  );
}

function fitTo(map: maplibregl.Map, places: Place[], instant: boolean) {
  const pts = places.filter((p) => p.lat !== null && p.lon !== null);
  if (pts.length === 0) return;
  const lats = pts.map((p) => p.lat as number);
  // Antimeridian-safe, same technique as lib/map/mercator.ts's lonLatCentroid: unwrap
  // every longitude relative to the first point before taking min/max, so a trip like
  // Tokyo <-> Honolulu gets the short bounding box, not one spanning the wrong 340° of
  // the globe. maplibregl.LngLatBounds represents a crossing box as west > east —
  // wrapping each unwrapped extreme back into [-180, 180) produces exactly that.
  const first = pts[0].lon as number;
  const unwrappedLons = pts.map((p) => {
    let d = (p.lon as number) - first;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return first + d;
  });
  const wrap = (lon: number) => (((lon + 180) % 360) + 360) % 360 - 180;
  const bounds: LngLatBoundsLike = [
    [wrap(Math.min(...unwrappedLons)), Math.min(...lats)],
    [wrap(Math.max(...unwrappedLons)), Math.max(...lats)],
  ];
  map.fitBounds(bounds, { padding: 72, duration: instant ? 0 : 500, maxZoom: 14 });
}
