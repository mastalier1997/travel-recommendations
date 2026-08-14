'use client';

import { useEffect, useRef } from 'react';
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
};

export function PlaceList({
  places,
  route,
  routeStale,
  selectedStopId,
  selectionSource,
  onSelect,
}: Props) {
  const refs = useRef(new Map<string, HTMLButtonElement>());

  // Pin → card. Moving focus is correct here: the user initiated it with a click, and
  // it is the only way a magnifier user finds the matching card.
  useEffect(() => {
    if (selectionSource !== 'map' || !selectedStopId) return;
    const el = refs.current.get(selectedStopId);
    if (!el) return;
    el.scrollIntoView({ block: 'nearest' });
    el.focus({ preventScroll: true });
  }, [selectedStopId, selectionSource]);

  const legByToId = new Map((route?.legs ?? []).map((l) => [l.toId, l]));
  const nameById = new Map(places.map((p) => [p.id, p.name]));

  return (
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
            cardRef={(el) => {
              if (el) refs.current.set(p.id, el);
              else refs.current.delete(p.id);
            }}
          />
        );
      })}
    </ol>
  );
}
