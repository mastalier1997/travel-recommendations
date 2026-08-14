'use client';

import { useCallback, useState } from 'react';
import type { OptimizeResponse, Plan, Place, Route } from '@/lib/types';
import { isRouteStale, orderHash } from '@/lib/routing/order';
import { useIsMobile, usePrefersReducedMotion } from '@/lib/hooks/useMediaQuery';
import { MapView } from './MapView';
import { PlaceList } from './PlaceList';
import { SummaryBar } from './SummaryBar';
import { BottomSheet } from './BottomSheet';
import { Header } from './Header';
import styles from './planner.module.css';

export function Planner({ initialPlan }: { initialPlan: Plan }) {
  const [places, setPlaces] = useState<Place[]>(initialPlan.places);
  const [route, setRoute] = useState<Route | null>(initialPlan.route);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [selectionSource, setSelectionSource] = useState<'map' | 'list' | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMobile = useIsMobile();
  const reducedMotion = usePrefersReducedMotion();
  const routeStale = isRouteStale(places, route);

  const selectFromMap = useCallback((id: string) => {
    setSelectedStopId(id);
    setSelectionSource('map');
    // Otherwise focus would land in an inert list.
    setSheetExpanded(true);
  }, []);

  const selectFromList = useCallback((id: string) => {
    setSelectedStopId((cur) => (cur === id ? null : id));
    setSelectionSource('list');
  }, []);

  const optimize = useCallback(async () => {
    const stops = places
      .filter((p) => p.lat !== null && p.lon !== null)
      .map((p) => ({ id: p.id, lat: p.lat as number, lon: p.lon as number }));
    if (stops.length < 2) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stops, mode: 'driving', roundTrip: false }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Could not optimize this route.');
        return;
      }

      const { order, route: solved } = body as OptimizeResponse;
      // The solver returns a permutation; the list is what carries order, so reorder
      // `places` itself rather than storing the order twice.
      const byId = new Map(places.map((p) => [p.id, p]));
      const reordered = order.map((id) => byId.get(id)).filter((p): p is Place => !!p);
      const next = [...reordered, ...places.filter((p) => !order.includes(p.id))];

      setPlaces(next);
      setRoute({ ...solved, orderHash: orderHash(next, solved.mode, solved.roundTrip) });
    } catch {
      setError('Could not reach the routing service.');
    } finally {
      setBusy(false);
    }
  }, [places]);

  const summary = (
    <SummaryBar
      places={places}
      route={route}
      routeStale={routeStale}
      onOptimize={optimize}
      busy={busy}
    />
  );

  const list = (
    <PlaceList
      places={places}
      route={route}
      routeStale={routeStale}
      selectedStopId={selectedStopId}
      selectionSource={selectionSource}
      onSelect={selectFromList}
    />
  );

  const map = (
    <MapView
      places={places}
      route={route}
      routeStale={routeStale}
      selectedStopId={selectedStopId}
      onSelectStop={selectFromMap}
      reducedMotion={reducedMotion}
    />
  );

  return (
    <div className={styles.shell} data-mobile={isMobile}>
      <a href="#stops" className={styles.skip}>
        Skip to stops list
      </a>

      <Header title={initialPlan.title} />

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.body}>
        {map}

        {isMobile ? (
          <BottomSheet
            expanded={sheetExpanded}
            onToggle={() => setSheetExpanded((v) => !v)}
            header={summary}
          >
            <div id="stops">{list}</div>
          </BottomSheet>
        ) : (
          <aside className={styles.panel} aria-label="Stops">
            <p className={styles.dropzone}>
              Drop a PDF, Excel, Markdown or text file — one place per line
            </p>
            {summary}
            <div id="stops" className={styles.panelScroll} data-scroll>
              {list}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
