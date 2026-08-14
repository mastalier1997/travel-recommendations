'use client';

import type { Place, RouteLeg } from '@/lib/types';
import { formatDistance, formatDurationShort } from '@/lib/format';
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
  cardRef,
}: Props) {
  const unresolved = place.status === 'unresolved';
  const meta = [regionLabel(place), categoryLabel(place)].filter(Boolean).join(' · ');

  return (
    <li className={styles.item}>
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

      <div
        className={styles.card}
        data-selected={selected}
        data-unresolved={unresolved}
      >
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
            {unresolved ? place.raw : place.name}
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
      </div>
    </li>
  );
}
