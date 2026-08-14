'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Place, RouteLeg } from '@/lib/types';
import { formatDistance, formatDurationShort } from '@/lib/format';
import { CardActions } from './CardActions';
import styles from './planner.module.css';

type Props = {
  place: Place;
  index: number;
  total: number;
  /** Leg arriving at this stop. Absent on the first stop. */
  leg?: { leg: RouteLeg; fromName: string };
  selected: boolean;
  stale: boolean;
  onSelect: (id: string) => void;
  onMove: (index: number, delta: number) => void;
  onMoveTo: (index: number, to: number) => void;
  onRemove: (index: number) => void;
  cardRef?: (el: HTMLButtonElement | null) => void;
};

/**
 * ponytail: titlecased OSM tag. Track E owns the ~40-entry label table
 * (content/osm-labels.ts); swap this call for it when that lands.
 */
function categoryLabel(place: Place): string | null {
  if (!place.osm) return null;
  return place.osm.tag.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function regionLabel(place: Place): string | null {
  const last = place.address?.split(',').pop()?.trim();
  return last || null;
}

export function PlaceCard({
  place,
  index,
  total,
  leg,
  selected,
  stale,
  onSelect,
  onMove,
  onMoveTo,
  onRemove,
  cardRef,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: place.id,
  });

  const unresolved = place.status === 'unresolved';
  const meta = [regionLabel(place), categoryLabel(place)].filter(Boolean).join(' · ');
  const displayName = unresolved ? place.raw : place.name;

  return (
    <li
      ref={setNodeRef}
      className={styles.item}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-dragging={isDragging}
    >
      {leg && (
        /*
         * The polyline's only unique information. Without it as text the map is not
         * decorative and 1.1.1 fails. Kept quiet so it does not compete with the cards.
         */
        <p className={`${styles.leg} ${stale ? styles.legStale : ''}`}>
          <span className={styles.legRule} aria-hidden="true" />
          {formatDistance(leg.leg.distanceM)} · {formatDurationShort(leg.leg.durationS)} from{' '}
          {leg.fromName}
        </p>
      )}

      <div className={styles.card} data-selected={selected} data-unresolved={unresolved}>
        {/*
         * A real button, not a div with tabIndex — that makes most of dnd-kit's
         * injected role/tabindex attributes redundant, which is the point.
         */}
        <button
          type="button"
          className={styles.grip}
          aria-label={`Reorder ${displayName}`}
          {...attributes}
          {...listeners}
        >
          <span aria-hidden="true">⠿</span>
        </button>

        <span className={styles.badge} aria-hidden="true">
          {index + 1}
        </span>

        <div className={styles.cardBody}>
          <button
            type="button"
            ref={cardRef}
            className={styles.cardName}
            aria-pressed={selected}
            onClick={() => onSelect(place.id)}
          >
            {/* Order is in the accessible name, not only in the badge. */}
            <span className="sr-only">{`Stop ${index + 1} of ${total}: `}</span>
            {displayName}
          </button>

          {unresolved ? (
            /* Never colour alone — the amber edge is backed by these words. */
            <p className={styles.needsReview}>Needs review — pick a match</p>
          ) : (
            <>
              {place.description && <p className={styles.cardDesc}>{place.description.text}</p>}
              {meta && <p className={styles.cardMeta}>{meta}</p>}
            </>
          )}
        </div>

        <CardActions
          name={displayName}
          index={index}
          total={total}
          onMove={(delta) => onMove(index, delta)}
          onMoveTo={(to) => onMoveTo(index, to)}
          onRemove={() => onRemove(index)}
        />
      </div>
    </li>
  );
}
