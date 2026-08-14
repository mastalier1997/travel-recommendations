'use client';

import type { Place, Route } from '@/lib/types';
import { MAX_STOPS_PER_ROUTE } from '@/lib/types';
import {
  formatDistance,
  formatDistanceSpoken,
  formatDurationLong,
  formatDurationSpoken,
} from '@/lib/format';
import styles from './planner.module.css';

type Props = {
  places: Place[];
  route: Route | null;
  routeStale: boolean;
  onOptimize: () => void;
  busy?: boolean;
};

export function SummaryBar({ places, route, routeStale, onOptimize, busy }: Props) {
  const needsReview = places.filter((p) => p.status === 'unresolved').length;
  const overCap = places.length > MAX_STOPS_PER_ROUTE;

  const stats = route
    ? `${formatDurationLong(route.totalDurationS)} · ${formatDistance(route.totalDistanceM)}`
    : 'No route yet';

  const spoken = route
    ? `${places.length} stops, ${formatDurationSpoken(route.totalDurationS)}, ${formatDistanceSpoken(route.totalDistanceM)}.`
    : `${places.length} stops, no route yet.`;

  return (
    <div className={styles.summary}>
      <div className={styles.summaryStats}>
        <p className={styles.summaryLine}>
          <strong>{places.length} stops</strong>
          <span aria-hidden="true"> · {stats}</span>
        </p>
        {/* Totals are announced once here rather than by each individual control. */}
        <p className="sr-only" role="status">
          {spoken}
        </p>

        <p className={styles.summaryNote}>
          {overCap
            ? `${MAX_STOPS_PER_ROUTE} stops max per route — remove ${places.length - MAX_STOPS_PER_ROUTE}`
            : `${MAX_STOPS_PER_ROUTE} stops max per route`}
        </p>
      </div>

      <div className={styles.summaryActions}>
        {needsReview > 0 && (
          <span className={styles.chip}>
            {needsReview} need{needsReview === 1 ? 's' : ''} review
          </span>
        )}
        <button
          type="button"
          className={`${styles.primary} on-accent`}
          onClick={onOptimize}
          aria-disabled={busy || overCap}
        >
          {busy ? 'Optimizing…' : routeStale || !route ? 'Optimize route' : 'Re-optimize'}
        </button>
      </div>
    </div>
  );
}
