'use client';

import { useEffect, useRef } from 'react';
import maplibregl, { type LngLatBoundsLike, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Place, Route } from '@/lib/types';
import styles from './planner.module.css';

const KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

/**
 * With no key we still render a working map — background paint, no tiles. The route
 * and pins are the point; this keeps the whole shell runnable with zero credentials
 * and avoids leaning on anyone's free tile server as a default.
 */
const NO_TILE_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e2e6dc' } }],
};

const STYLE = KEY
  ? `https://api.maptiler.com/maps/landscape/style.json?key=${KEY}`
  : NO_TILE_STYLE;

type Props = {
  places: Place[];
  route: Route | null;
  /** Route is drawn greyed when the list order has moved on from it. */
  routeStale: boolean;
  selectedStopId: string | null;
  onSelectStop: (id: string) => void;
  reducedMotion: boolean;
};

export function MapView({
  places,
  route,
  routeStale,
  selectedStopId,
  onSelectStop,
  reducedMotion,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef(new Map<string, maplibregl.Marker>());
  // Latest callback without re-creating markers on every parent render.
  const onSelectRef = useRef(onSelectStop);
  onSelectRef.current = onSelectStop;

  // --- init ---------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
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

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // --- route line ---------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const data = route
        ? { type: 'Feature' as const, properties: {}, geometry: route.geometry }
        : { type: 'FeatureCollection' as const, features: [] };

      const src = map.getSource('route') as maplibregl.GeoJSONSource | undefined;
      if (src) {
        src.setData(data);
      } else {
        map.addSource('route', { type: 'geojson', data });
        // Casing first. White under terracotta is 4.05:1, so the line's shape stays
        // legible over any tile colour — which no single stroke colour can guarantee.
        map.addLayer({
          id: 'route-casing',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 10 },
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#c2643f', 'line-width': 6 },
        });
      }
      if (map.getLayer('route-line')) {
        map.setPaintProperty('route-line', 'line-color', routeStale ? '#9a9288' : '#c2643f');
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [route, routeStale]);

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
          <>No map tiles — set NEXT_PUBLIC_MAPTILER_KEY</>
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
