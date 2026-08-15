'use client';

import { useEffect, useRef } from 'react';
import maplibregl, { type LngLatBoundsLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Place, Route } from '@/lib/types';
import { usePrefersDark } from '@/lib/hooks/useMediaQuery';
import { MAP_COLORS, mapStyleUrl, resolveMapTheme } from '@/lib/map/mapTheme';
import styles from './planner.module.css';

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

  const prefersDark = usePrefersDark();
  const mapTheme = resolveMapTheme(prefersDark, Boolean(KEY));
  const styleUrl = mapStyleUrl(mapTheme, KEY);
  const appliedStyleRef = useRef(styleUrl);
  // Reattaching the route layers is route-effect's job; style.load (fired on
  // init AND on every setStyle) just needs to call whatever that latest logic is.
  const applyRouteRef = useRef<() => void>(() => {});

  // --- init ---------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: appliedStyleRef.current,
      center: [135.7, 34.9],
      zoom: 8,
      // Own controls live outside the aria-hidden subtree; the canvas itself must not
      // be a tab stop or a keyboard target.
      attributionControl: false,
      keyboard: false,
    });
    mapRef.current = map;

    map.getCanvas().setAttribute('aria-hidden', 'true');
    map.getCanvas().tabIndex = -1;
    map.on('style.load', () => applyRouteRef.current());

    return () => {
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
      const data = route
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

      // Ferry legs as their own dashed overlay, drawn straight between endpoints — OSRM
      // can't route water, so there's no real road geometry to draw here in the first
      // place. Never color-only: the list's leg row carries "Ferry · Not driving time" in text.
      const placeById = new Map(places.map((p) => [p.id, p]));
      const ferryLegs = (route?.legs ?? []).filter((leg) => leg.mode === 'ferry');
      const ferryData = {
        type: 'FeatureCollection' as const,
        features: ferryLegs.flatMap((leg) => {
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
      const ferrySrc = map.getSource('route-ferries') as maplibregl.GeoJSONSource | undefined;
      if (ferrySrc) {
        ferrySrc.setData(ferryData);
      } else {
        map.addSource('route-ferries', { type: 'geojson', data: ferryData });
        map.addLayer({
          id: 'route-ferries',
          type: 'line',
          source: 'route-ferries',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': colors.ferry, 'line-width': 4, 'line-dasharray': [2, 2] },
        });
      }
      if (map.getLayer('route-ferries')) {
        map.setPaintProperty('route-ferries', 'line-color', colors.ferry);
      }
    };

    // style.load (registered once, at init) reruns whatever apply() this
    // effect last handed it — including across a setStyle triggered by a
    // theme change, when the source/layers above have just been wiped.
    applyRouteRef.current = apply;
    if (map.isStyleLoaded()) apply();
  }, [route, routeStale, mapTheme, places]);

  // --- markers ------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const live = new Set<string>();

    places.forEach((p, i) => {
      if (p.lat === null || p.lon === null) return;
      live.add(p.id);

      let marker = markersRef.current.get(p.id);
      if (!marker) {
        const el = document.createElement('div');
        el.className = styles.pin;
        // Pins are a pointer shortcut, nothing more. Everything they convey — order,
        // name, distance — is text in the list.
        el.setAttribute('aria-hidden', 'true');
        el.tabIndex = -1;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectRef.current(p.id);
        });
        marker = new maplibregl.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(map);
        markersRef.current.set(p.id, marker);
      } else {
        marker.setLngLat([p.lon, p.lat]);
      }

      const el = marker.getElement();
      el.textContent = String(i + 1);
      el.dataset.unresolved = String(p.status === 'unresolved');
      el.dataset.selected = String(p.id === selectedStopId);
    });

    markersRef.current.forEach((m, id) => {
      if (!live.has(id)) {
        m.remove();
        markersRef.current.delete(id);
      }
    });
  }, [places, selectedStopId]);

  // --- fit to all stops on first paint ------------------------------------
  const fittedRef = useRef(false);
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

  return (
    <div className={styles.mapWrap}>
      <div ref={containerRef} className={styles.mapCanvas} aria-hidden="true" />

      {/* Controls and attribution sit outside the aria-hidden subtree on purpose. */}
      <div className={styles.mapControls}>
        <button type="button" onClick={() => zoom(1)} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => zoom(-1)} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={fitAll} aria-label="Fit map to all stops">
          ⤢
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
  const lons = pts.map((p) => p.lon as number);
  const lats = pts.map((p) => p.lat as number);
  const bounds: LngLatBoundsLike = [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ];
  map.fitBounds(bounds, { padding: 72, duration: instant ? 0 : 500, maxZoom: 14 });
}
