'use client';

import type { Place, Route } from '@/lib/types';
import { MAX_STOPS_SOLVED } from '@/lib/types';
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
  // Below this, order-solving always happens — exactly (OSRM /trip) under 12 stops,
  // heuristically (lib/routing/solve.ts) up to this cap. That distinction is
  // deliberately invisible here — see app/api/optimize/route.ts.
  const overCap = places.length > MAX_STOPS_SOLVED;
  const actionLabel = busy
    ? overCap
      ? 'Routing…'
      : 'Optimizing…'
    : overCap
      ? 'Route'
      : routeStale || !route
        ? 'Optimize route'
        : 'Re-optimize';

  const stats = route
    ? `${formatDurationLong(route.totalDurationS)} · ${formatDistance(route.totalDistanceM)}`
    : 'No route yet';

  // A continental-scale route's geometry is simplified (lib/geo/simplify.ts, set in
  // app/api/optimize/route.ts) — that's an accuracy claim about the numbers below,
  // not just a map-drawing detail, so it's stated here rather than only as a map badge.
  const spoken = route
    ? `${places.length} stops, ${formatDurationSpoken(route.totalDurationS)}, ${formatDistanceSpoken(route.totalDistanceM)}${route.generalized ? ', route simplified for this zoom' : ''}.`
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
            ? `Order auto-optimizes up to ${MAX_STOPS_SOLVED} stops — this trip routes in its current order`
            : `${MAX_STOPS_SOLVED} stops max per auto-optimize`}
        </p>
        {route?.generalized && (
          <p className={styles.summaryNote}>Route simplified for this zoom — zoom in on the map for turn-by-turn shape</p>
        )}
      </div>

      <div className={styles.summaryActions} aria-busy={busy}>
        {needsReview > 0 && (
          <span className={styles.chip}>
            {needsReview} need{needsReview === 1 ? 's' : ''} review
          </span>
        )}
        <button
          type="button"
          className={`${styles.primary} on-accent`}
          onClick={onOptimize}
          aria-disabled={busy}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
