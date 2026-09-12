'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Place, RouteLeg } from '@/lib/types';
import { formatDistance, formatLegDuration } from '@/lib/format';
import { labelForOsmTag } from '@/lib/content/osm-labels';
import { CardActions } from './CardActions';
import styles from './planner.module.css';

type Props = {
  place: Place;
  index: number;
  total: number;
  /** Leg arriving at this stop. Absent on the first stop, and on a country group's
   * first stop — that leg is shown once, as the group's border/ferry row instead. */
  leg?: { leg: RouteLeg; fromName: string };
  /** True when this is the single longest leg in the whole route (continental scale). */
  legIsLongest?: boolean;
  selected: boolean;
  stale: boolean;
  /** Flagged by the last failed optimize as likely unreachable by road — never
   * true alongside `unresolved` (an unresolved place has no coords, so it's never
   * sent to /api/optimize in the first place). */
  unreachable: boolean;
  onSelect: (id: string) => void;
  onMove: (index: number, delta: number) => void;
  onMoveTo: (index: number, to: number) => void;
  onRemove: (index: number) => void;
  cardRef?: (el: HTMLButtonElement | null) => void;
  /** True while a list filter is active — dragging a gapped view is confusing, so the
   * grip is disabled (the actions menu's "Move to position" still works, unaffected). */
  dragDisabled?: boolean;
};

function categoryLabel(place: Place): string | null {
  if (!place.osm) return null;
  return labelForOsmTag(place.osm.class, place.osm.tag);
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
  legIsLongest,
  selected,
  stale,
  unreachable,
  onSelect,
  onMove,
  onMoveTo,
  onRemove,
  cardRef,
  dragDisabled,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: place.id,
    disabled: dragDisabled,
  });

  const unresolved = place.status === 'unresolved';
  const meta = [regionLabel(place), categoryLabel(place)].filter(Boolean).join(' · ');
  const displayName = unresolved ? place.raw : place.name;
  const unreachableReasonId = unreachable ? `unreachable-${place.id}` : undefined;

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
         * Mode-aware: a direct leg (no road route found — see RouteLeg.mode) has no
         * real driving time and a straight-line, not road, distance. Same honesty
         * contract as the country-crossing row in PlaceList — never let this read
         * as a fabricated drive.
         */
        <p
          className={`${styles.leg} ${stale ? styles.legStale : ''} ${leg.leg.mode === 'direct' ? styles.legDirect : ''}`}
          data-leg-mode={leg.leg.mode === 'direct' ? 'direct' : undefined}
        >
          <span className={styles.legRule} aria-hidden="true" />
          {leg.leg.mode === 'direct' ? (
            <>
              Direct line · {formatDistance(leg.leg.distanceM)} straight line from {leg.fromName} · no road route found
              <strong> · Not driving distance or time</strong>
            </>
          ) : (
            <>
              {formatDistance(leg.leg.distanceM)} · {formatLegDuration(leg.leg.durationS)} from {leg.fromName}
              {legIsLongest && ' · Longest leg'}
            </>
          )}
        </p>
      )}

      <div className={styles.card} data-selected={selected} data-unresolved={unresolved} data-unreachable={unreachable}>
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
            aria-describedby={unreachableReasonId}
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
              {unreachable && (
                /* Never colour alone — the danger edge is backed by these words. */
                <p id={unreachableReasonId} className={styles.unreachableReason}>
                  Not reachable by road — its location may be off
                </p>
              )}
              {place.description && (
                <p className={styles.cardDesc} lang={place.description.lang ?? undefined}>
                  {place.description.text}
                </p>
              )}
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
