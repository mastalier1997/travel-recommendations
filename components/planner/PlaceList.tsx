'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type ScreenReaderInstructions,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Place, Route } from '@/lib/types';
import { groupByCountry, type CountryGroup } from '@/lib/plan/groupByCountry';
import { formatDistance, formatDurationLong, formatDurationShort } from '@/lib/format';
import { PlaceCard } from './PlaceCard';
import styles from './planner.module.css';

type Props = {
  places: Place[];
  route: Route | null;
  routeStale: boolean;
  selectedStopId: string | null;
  /** 'map' means the user clicked a pin, so focus should follow into the list. */
  selectionSource: 'map' | 'list' | null;
  onSelect: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove: (index: number) => void;
  onDragStateChange: (dragging: boolean) => void;
  /** Set by the parent to pull focus onto a card after a remove. */
  focusIndex: number | null;
  onFocusHandled: () => void;
};

const instructions: ScreenReaderInstructions = {
  draggable:
    'Press space or enter to start reordering this stop. Use the up and down arrows to move it, space or enter to drop, escape to cancel. Or use the stop actions menu to move it without dragging.',
};

const groupKey = (g: CountryGroup) => `${g.countryCode ?? 'unknown'}-${g.startIndex}`;

export function PlaceList({
  places,
  route,
  routeStale,
  selectedStopId,
  selectionSource,
  onSelect,
  onReorder,
  onRemove,
  onDragStateChange,
  focusIndex,
  onFocusHandled,
}: Props) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const headingRefs = useRef(new Map<string, HTMLHeadingElement>());
  // Announcements are built once and must not close over a stale places array.
  const placesRef = useRef(places);
  placesRef.current = places;

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');

  const sensors = useSensors(
    // Desktop: immediate drag off the grip. Touch: long-press, so a vertical swipe
    // still scrolls the sheet instead of picking up a card.
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Pin → card. Moving focus is correct here: the user initiated it with a click, and
  // it is the only way a magnifier user finds the matching card.
  useEffect(() => {
    if (selectionSource !== 'map' || !selectedStopId) return;
    const el = refs.current.get(selectedStopId);
    if (!el) return;
    el.scrollIntoView({ block: 'nearest' });
    el.focus({ preventScroll: true });
  }, [selectedStopId, selectionSource]);

  // Focus never gets stranded on a removed card.
  useEffect(() => {
    if (focusIndex === null) return;
    const target = places[focusIndex];
    if (target) refs.current.get(target.id)?.focus({ preventScroll: true });
    onFocusHandled();
  }, [focusIndex, places, onFocusHandled]);

  const nameOf = (id: unknown) => {
    const p = placesRef.current.find((x) => x.id === id);
    return p ? (p.status === 'unresolved' ? p.raw : p.name) : 'stop';
  };
  const posOf = (id: unknown) => placesRef.current.findIndex((x) => x.id === id) + 1;

  // dnd-kit's defaults say "sortable item" and use array indices. For a numbered
  // itinerary that is wrong on both counts.
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${nameOf(active.id)}, stop ${posOf(active.id)} of ${placesRef.current.length}. Use arrow up and arrow down to move, space to drop, escape to cancel.`,
    // Both sensors fire onDragOver over the item itself the instant it is lifted,
    // which would overwrite "Picked up…" before it is ever read out. Nothing has
    // moved, so say nothing.
    onDragOver: ({ active, over }) =>
      !over
        ? `${nameOf(active.id)} is outside the list.`
        : over.id === active.id
          ? undefined
          : `${nameOf(active.id)} moved to position ${posOf(over.id)} of ${placesRef.current.length}.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} dropped at position ${posOf(over.id)} of ${placesRef.current.length}. Route updated.`
        : `${nameOf(active.id)} returned to position ${posOf(active.id)}.`,
    onDragCancel: ({ active }) =>
      `Reorder cancelled. ${nameOf(active.id)} returned to position ${posOf(active.id)}.`,
  };

  const handleDragEnd = (e: DragEndEvent) => {
    onDragStateChange(false);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = places.findIndex((p) => p.id === active.id);
    const to = places.findIndex((p) => p.id === over.id);
    if (from >= 0 && to >= 0) onReorder(from, to);
  };

  const legByToId = new Map((route?.legs ?? []).map((l) => [l.toId, l]));
  const nameById = new Map(places.map((p) => [p.id, p.name]));
  const groups = useMemo(() => groupByCountry(places, route), [places, route]);
  const grouped = groups.length > 1;

  const longestLegKey = useMemo(() => {
    const legs = route?.legs ?? [];
    if (legs.length < 2) return null;
    const longest = legs.reduce((a, b) => (b.distanceM > a.distanceM ? b : a));
    return `${longest.fromId}>${longest.toId}`;
  }, [route]);

  const card = (p: Place, index: number, opts?: { dragDisabled?: boolean; suppressLeg?: boolean }) => {
    const leg = opts?.suppressLeg ? undefined : legByToId.get(p.id);
    const fromName = leg ? nameById.get(leg.fromId) : undefined;
    return (
      <PlaceCard
        key={p.id}
        place={p}
        index={index}
        total={places.length}
        leg={leg && fromName ? { leg, fromName } : undefined}
        legIsLongest={leg ? `${leg.fromId}>${leg.toId}` === longestLegKey : false}
        selected={p.id === selectedStopId}
        stale={routeStale}
        onSelect={onSelect}
        onMove={(i, delta) => onReorder(i, i + delta)}
        onMoveTo={(i, to) => onReorder(i, to)}
        onRemove={onRemove}
        dragDisabled={opts?.dragDisabled}
        cardRef={(el) => {
          if (el) refs.current.set(p.id, el);
          else refs.current.delete(p.id);
        }}
      />
    );
  };

  const toggleCollapse = (key: string) =>
    setCollapsed((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const jumpTo = (g: CountryGroup) => (e: React.MouseEvent) => {
    e.preventDefault();
    const key = groupKey(g);
    if (collapsed.has(key)) toggleCollapse(key);
    // Wait for the (now expanded) heading to exist before focusing/scrolling it.
    requestAnimationFrame(() => {
      const el = headingRefs.current.get(key);
      el?.scrollIntoView({ block: 'start' });
      el?.focus({ preventScroll: true });
    });
  };

  const filterLower = filter.trim().toLowerCase();
  const matches = (p: Place) =>
    !filterLower || (p.status === 'unresolved' ? p.raw : p.name).toLowerCase().includes(filterLower);

  // Not grouped: the common case (one region, or no countryCode data at all) renders
  // exactly as it always has — a flat sortable list, no header/filter/chip chrome.
  if (!grouped) {
    return (
      <DndContext
        id="stops-dnd"
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        accessibility={{ announcements, screenReaderInstructions: instructions }}
        onDragStart={() => onDragStateChange(true)}
        onDragCancel={() => onDragStateChange(false)}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={places.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <ol className={styles.list} role="list">
            {places.map((p, i) => card(p, i))}
          </ol>
        </SortableContext>
      </DndContext>
    );
  }

  const visibleIds = groups.flatMap((g) =>
    collapsed.has(groupKey(g)) ? [] : g.places.filter(matches).map((p) => p.id),
  );
  const totalMatches = groups.reduce((n, g) => n + g.places.filter(matches).length, 0);

  return (
    <>
      <div className={styles.groupControls}>
        <label className={styles.filterField}>
          <span className="sr-only">Filter stops</span>
          <input
            type="search"
            placeholder={`Filter ${places.length} stops…`}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>
        {filterLower && (
          <p role="status" className="sr-only">
            {totalMatches} of {places.length} stops match.
          </p>
        )}
        <nav aria-label="Jump to country" className={styles.jumpChips}>
          {groups.map((g) => (
            <a key={groupKey(g)} href={`#${groupKey(g)}`} onClick={jumpTo(g)}>
              {g.countryLabel}
            </a>
          ))}
        </nav>
      </div>

      <DndContext
        id="stops-dnd"
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        accessibility={{ announcements, screenReaderInstructions: instructions }}
        onDragStart={() => onDragStateChange(true)}
        onDragCancel={() => onDragStateChange(false)}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
          <ol className={styles.list} role="list">
            {groups.map((g) => {
              const key = groupKey(g);
              const isCollapsed = collapsed.has(key);
              const shownPlaces = g.places.filter(matches);

              return (
                <li key={key} id={key} className={styles.countryGroup} aria-labelledby={`${key}-h`}>
                  {g.entryLeg && (
                    <p className={g.entryLeg.mode === 'ferry' ? styles.ferryRow : styles.borderRow}>
                      {g.entryLeg.mode === 'ferry' ? (
                        <>
                          Ferry · {nameById.get(g.entryLeg.fromId)} → {nameById.get(g.entryLeg.toId)} ·{' '}
                          {formatDistance(g.entryLeg.distanceM)} · {formatDurationShort(g.entryLeg.durationS)} ·
                          overnight · vehicle booking required
                          <strong> · Not driving time</strong>
                        </>
                      ) : (
                        <>
                          {formatDistance(g.entryLeg.distanceM)} · {formatDurationShort(g.entryLeg.durationS)} ·
                          crossing into {g.countryLabel}
                        </>
                      )}
                    </p>
                  )}

                  <h3
                    id={`${key}-h`}
                    tabIndex={-1}
                    className={styles.countryHeading}
                    ref={(el) => {
                      if (el) headingRefs.current.set(key, el);
                      else headingRefs.current.delete(key);
                    }}
                  >
                    <button
                      type="button"
                      className={styles.countryToggle}
                      aria-expanded={!isCollapsed}
                      aria-controls={`${key}-body`}
                      onClick={() => toggleCollapse(key)}
                    >
                      <span aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span>
                      {g.countryLabel} · {g.places.length} stop{g.places.length === 1 ? '' : 's'} ·{' '}
                      {formatDistance(g.distanceM)} · {formatDurationLong(g.durationS)}
                      {isCollapsed ? ', collapsed' : ''}
                    </button>
                  </h3>

                  {!isCollapsed && (
                    <ol id={`${key}-body`} role="list" className={styles.list}>
                      {shownPlaces.map((p) => {
                        const globalIndex = places.findIndex((x) => x.id === p.id);
                        const suppressLeg = !!g.entryLeg && p.id === g.places[0].id;
                        return card(p, globalIndex, { dragDisabled: !!filterLower, suppressLeg });
                      })}
                    </ol>
                  )}
                </li>
              );
            })}
          </ol>
        </SortableContext>
      </DndContext>
    </>
  );
}
