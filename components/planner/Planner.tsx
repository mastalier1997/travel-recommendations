'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OptimizeResponse, Plan, Place, Route, UnreachableDiagnosis } from '@/lib/types';
import { isRouteStale, orderHash } from '@/lib/routing/order';
import { focusIndexAfterRemove, insertAt, moveTo, removeAt } from '@/lib/plan/reorder';
import { useIsMobile, usePrefersReducedMotion } from '@/lib/hooks/useMediaQuery';
import { useAutosave, type SaveResult } from '@/lib/hooks/useAutosave';
import type { RenameResult } from '@/lib/plan/title';
import { MapView } from './MapView';
import { PlaceList } from './PlaceList';
import { SummaryBar } from './SummaryBar';
import { BottomSheet } from './BottomSheet';
import { Header } from './Header';
import { AddStopSearch } from './AddStopSearch';
import styles from './planner.module.css';

const UNDO_MS = 10_000;

function nameForId(places: Place[], id: string): string | null {
  const p = places.find((x) => x.id === id);
  return p ? (p.status === 'unresolved' ? p.raw : p.name) : null;
}

/** The server can only send an id (see OptimizeRequest — no place names cross
 * that wire). Composing the human-readable version is a client job, done live
 * against the current `places` so a since-removed id just drops out instead of
 * going stale. Only the truly-unsnappable-coordinate case reaches this now — a
 * road gap between two otherwise-fine stops is routed with a direct line instead
 * of erroring (see lib/routing/reachability.ts). */
function describeUnreachable(diagnosis: UnreachableDiagnosis, places: Place[]): string | null {
  const name = nameForId(places, diagnosis.stopId);
  return name && `${name} doesn't seem to be reachable by road — its location may be off. Try relocating or removing it.`;
}

type Props = {
  initialPlan: Plan;
  /** Absent in fixture mode: the demo planner on `/` persists nothing. */
  onSave?: (input: {
    places: Place[];
    route: Route | null;
    version: number;
  }) => Promise<SaveResult>;
  plans?: { id: string; title: string }[];
  /** Absent in fixture mode: nowhere real to persist a rename to. */
  onRename?: (title: string) => Promise<RenameResult>;
  /** Undefined in fixture mode — there is no signed-in user to show or sign out. */
  account?: { email: string };
};

export function Planner({ initialPlan, onSave, onRename, plans, account }: Props) {
  const [places, setPlaces] = useState<Place[]>(initialPlan.places);
  const [route, setRoute] = useState<Route | null>(initialPlan.route);
  const [title, setTitle] = useState(initialPlan.title);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [selectionSource, setSelectionSource] = useState<'map' | 'list' | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; unreachable?: UnreachableDiagnosis } | null>(null);
  const [errorToken, setErrorToken] = useState(0);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [removed, setRemoved] = useState<{ place: Place; index: number } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conflictAlertRef = useRef<HTMLParagraphElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const isMobile = useIsMobile();
  const reducedMotion = usePrefersReducedMotion();
  const routeStale = isRouteStale(places, route);

  useEffect(() => () => void (undoTimer.current && clearTimeout(undoTimer.current)), []);

  const noop = useCallback(async () => ({ ok: true as const, version: initialPlan.version }), [
    initialPlan.version,
  ]);
  const save = useAutosave({
    enabled: !!onSave,
    places,
    route,
    initialVersion: initialPlan.version,
    // Writing on every frame of a reorder would be pointless traffic.
    paused: dragging,
    onSave: onSave ?? noop,
  });

  // The alert names an action ("Reload the latest version") but role="alert" never
  // moves focus on its own — without this a keyboard/screen-reader user hears there's
  // a button and has to go hunt for it.
  useEffect(() => {
    if (save.status === 'conflict') {
      requestAnimationFrame(() => conflictAlertRef.current?.focus());
    }
  }, [save.status]);

  // Same reasoning, for a failed optimize: role="alert" never moves focus on its
  // own. Keyed on a token (bumped only from the optimize() failure path below, not
  // from removeUnreachableStop's follow-up updates) so acting on the alert doesn't
  // yank focus back into it.
  useEffect(() => {
    if (errorToken > 0) requestAnimationFrame(() => errorRef.current?.focus());
  }, [errorToken]);

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

  // Appends to the end of the itinerary — same route-staleness handling as reorder,
  // since the solver's answer no longer describes the (now longer) list either.
  const addPlace = useCallback((place: Place) => {
    setPlaces((cur) => [...cur, place]);
    setRoute((cur) => (cur ? { ...cur, optimized: false } : cur));
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

        // Whichever path removed this place (the alert below, or the card's own
        // "Remove from plan"), a flagged id it was carrying is now stale.
        setError((cur) => (cur?.unreachable?.stopId === place.id ? null : cur));

        const next = removeAt(cur, index);
        const focus = focusIndexAfterRemove(index, cur.length);
        setFocusIndex(focus >= 0 ? focus : null);
        setSelectedStopId((sel) => (sel === place.id ? null : sel));
        return next;
      });
    },
    [],
  );

  // One action per flagged stop (see the optimize() error banner) — reuses `remove`
  // and `selectFromMap` as-is rather than a second removal/selection path.
  const removeUnreachableStop = useCallback(
    (id: string) => {
      const index = places.findIndex((p) => p.id === id);
      if (index === -1) return;
      // The button lives in the top banner, outside the mobile sheet — without this,
      // remove()'s own focus-the-neighbor step would land on a card inside an inert,
      // collapsed sheet. Same reasoning as selectFromMap.
      setSheetExpanded(true);
      remove(index);
    },
    [places, remove],
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
        setError({ message: body.error ?? 'Could not optimize this route.', unreachable: body.unreachable });
        setErrorToken((t) => t + 1);
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
      setError({ message: 'Could not reach the routing service.' });
      setErrorToken((t) => t + 1);
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

  // The flagged id, if it's still actually in the plan — see the error banner
  // below for why this is checked live rather than trusted as-is.
  const unreachableId = error?.unreachable?.stopId;
  const unreachableIds = new Set(unreachableId && places.some((p) => p.id === unreachableId) ? [unreachableId] : []);

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
      unreachableIds={unreachableIds}
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

      <Header
        title={title}
        onRename={onRename}
        onRenamed={setTitle}
        currentId={initialPlan.id}
        plans={plans}
        saveStatus={onSave ? save.status : undefined}
        places={places}
        route={route}
        isMobile={isMobile}
        canImport={!!onSave}
        account={account}
      />

      {save.status === 'conflict' && (
        <p ref={conflictAlertRef} tabIndex={-1} className={styles.error} role="alert">
          This plan was changed somewhere else, so your recent edits were not saved.{' '}
          <button type="button" className={styles.undoBtn} onClick={() => location.reload()}>
            Reload the latest version
          </button>
        </p>
      )}

      {save.status === 'error' && save.error && (
        <p className={styles.error} role="alert">
          Could not save: {save.error}
        </p>
      )}

      {error && (() => {
        const unreachable = error.unreachable;
        const flaggedId = [...unreachableIds][0];
        const message = (unreachable && describeUnreachable(unreachable, places)) ?? error.message;

        return (
          // A single role="alert" (not a role="group" wrapper around it) — same
          // element the conflict alert above already uses. axe's landmark-region
          // check exempts live-region roles like alert but not "group", and this
          // sits outside <main> same as that one.
          <div ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>
            <p>{message}</p>
            {flaggedId && (
              <div className={styles.errorActions}>
                <button type="button" className={styles.undoBtn} onClick={() => removeUnreachableStop(flaggedId)}>
                  Remove {nameForId(places, flaggedId)} from plan
                </button>
              </div>
            )}
          </div>
        );
      })()}

      <main className={styles.body}>
        {/* The plan's <h1> now lives in Header (visible, with the rename trigger)
            rather than duplicated here as a screen-reader-only heading. */}
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
            <h2 className="sr-only">Stops</h2>
            <AddStopSearch places={places} route={route} selectedStopId={selectedStopId} onAddPlace={addPlace} />
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
      </main>
    </div>
  );
}
