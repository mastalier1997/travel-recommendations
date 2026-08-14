'use client';

import { useEffect, useRef } from 'react';
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
  // Announcements are built once and must not close over a stale places array.
  const placesRef = useRef(places);
  placesRef.current = places;

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

  return (
    <DndContext
      // Without a stable id, dnd-kit derives "DndDescribedBy-N" from a module-level
      // counter that starts over on the client — the ids disagree and hydration fails.
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
          {places.map((p, i) => {
            const leg = legByToId.get(p.id);
            const fromName = leg ? nameById.get(leg.fromId) : undefined;
            return (
              <PlaceCard
                key={p.id}
                place={p}
                index={i}
                total={places.length}
                leg={leg && fromName ? { leg, fromName } : undefined}
                selected={p.id === selectedStopId}
                stale={routeStale}
                onSelect={onSelect}
                onMove={(index, delta) => onReorder(index, index + delta)}
                onMoveTo={(index, to) => onReorder(index, to)}
                onRemove={onRemove}
                cardRef={(el) => {
                  if (el) refs.current.set(p.id, el);
                  else refs.current.delete(p.id);
                }}
              />
            );
          })}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
