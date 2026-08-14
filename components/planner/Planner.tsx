'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OptimizeResponse, Plan, Place, Route } from '@/lib/types';
import { isRouteStale, orderHash } from '@/lib/routing/order';
import { focusIndexAfterRemove, insertAt, moveTo, removeAt } from '@/lib/plan/reorder';
import { useIsMobile, usePrefersReducedMotion } from '@/lib/hooks/useMediaQuery';
import { MapView } from './MapView';
import { PlaceList } from './PlaceList';
import { SummaryBar } from './SummaryBar';
import { BottomSheet } from './BottomSheet';
import { Header } from './Header';
import styles from './planner.module.css';

const UNDO_MS = 10_000;

export function Planner({ initialPlan }: { initialPlan: Plan }) {
  const [places, setPlaces] = useState<Place[]>(initialPlan.places);
  const [route, setRoute] = useState<Route | null>(initialPlan.route);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [selectionSource, setSelectionSource] = useState<'map' | 'list' | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [removed, setRemoved] = useState<{ place: Place; index: number } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMobile = useIsMobile();
  const reducedMotion = usePrefersReducedMotion();
  const routeStale = isRouteStale(places, route);

  useEffect(() => () => void (undoTimer.current && clearTimeout(undoTimer.current)), []);

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

  // One path for every order change — drag, arrow keys, and the actions menu all land here.
  const reorder = useCallback((from: number, to: number) => {
    setPlaces((cur) => moveTo(cur, from, Math.max(0, Math.min(to, cur.length - 1))));
    // The solver's answer no longer describes this list; orderHash makes that visible.
    setRoute((cur) => (cur ? { ...cur, optimized: false } : cur));
  }, []);

  const remove = useCallback(
    (index: number) => {
      setPlaces((cur) => {
        const place = cur[index];
        if (!place) return cur;

        if (undoTimer.current) clearTimeout(undoTimer.current);
        setRemoved({ place, index });
        undoTimer.current = setTimeout(() => setRemoved(null), UNDO_MS);

        const next = removeAt(cur, index);
        const focus = focusIndexAfterRemove(index, cur.length);
        setFocusIndex(focus >= 0 ? focus : null);
        setSelectedStopId((sel) => (sel === place.id ? null : sel));
        return next;
      });
    },
    [],
  );

  const undoRemove = useCallback(() => {
    if (!removed) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setPlaces((cur) => insertAt(cur, removed.index, removed.place));
    setFocusIndex(removed.index);
    setRemoved(null);
  }, [removed]);

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

  const undoRow = removed && (
    <div className={styles.undo}>
      <p role="status">
        Removed {removed.place.status === 'unresolved' ? removed.place.raw : removed.place.name}.{' '}
        {places.length} stop{places.length === 1 ? '' : 's'} remaining.
      </p>
      <button type="button" className={styles.undoBtn} onClick={undoRemove}>
        Undo
      </button>
    </div>
  );

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
      onReorder={reorder}
      onRemove={remove}
      onDragStateChange={setDragging}
      focusIndex={focusIndex}
      onFocusHandled={() => setFocusIndex(null)}
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
      // Drag, a scrollable sheet and a pannable map are three gesture handlers over
      // the same pixels. One flag arbitrates: while a card is in the air, the map
      // stops panning and the sheet stops resizing.
      interactionLocked={dragging}
    />
  );

  return (
    <div className={styles.shell} data-mobile={isMobile} data-dragging={dragging}>
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
            locked={dragging}
            header={
              <>
                {undoRow}
                {summary}
              </>
            }
          >
            <div id="stops">{list}</div>
          </BottomSheet>
        ) : (
          <aside className={styles.panel} aria-label="Stops">
            <p className={styles.dropzone}>
              Drop a PDF, Excel, Markdown or text file — one place per line
            </p>
            {undoRow}
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
