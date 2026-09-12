'use client';

import { useMemo } from 'react';
import type { Place, Route } from '@/lib/types';
import { MAX_STOPS_SOLVED } from '@/lib/types';
import {
  formatDistance,
  formatDistanceSpoken,
  formatDurationLong,
  formatDurationSpoken,
} from '@/lib/format';
import { groupByCountry, groupKey } from '@/lib/plan/groupByCountry';
import styles from './planner.module.css';

type Props = {
  places: Place[];
  route: Route | null;
  routeStale: boolean;
  onOptimize: () => void;
  busy?: boolean;
};

export function SummaryBar({ places, route, routeStale, onOptimize, busy }: Props) {
  // Recomputed here rather than lifted to shared state — same call PlaceList and
  // MapView each make on their own; groupByCountry is cheap and pure.
  const groups = useMemo(() => groupByCountry(places, route), [places, route]);
  const grouped = groups.length > 1;

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
  // Same reasoning for directLegCount: when >0, totalDurationS excludes those legs
  // entirely (no real driving time to add) and totalDistanceM includes them as
  // straight lines — the total would otherwise silently under-report time spent.
  const directNote = route?.directLegCount
    ? `, time total excludes ${route.directLegCount} direct-line leg${route.directLegCount === 1 ? '' : 's'} with no road route`
    : '';
  const spoken = route
    ? `${places.length} stops, ${formatDurationSpoken(route.totalDurationS)}, ${formatDistanceSpoken(route.totalDistanceM)}${route.generalized ? ', route simplified for this zoom' : ''}${directNote}.`
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
        {!!route?.directLegCount && (
          <p className={styles.summaryNote}>
            Total time excludes {route.directLegCount} direct-line leg{route.directLegCount === 1 ? '' : 's'} with no
            road route — distance includes {route.directLegCount === 1 ? 'it' : 'them'} as straight lines
          </p>
        )}

        {/* Decorative: every group's own km/time already exists as real text on its
            sticky heading in the list below (PlaceList's countryToggle) — this bar
            adds an at-a-glance proportion, not a new fact. */}
        {grouped && route && route.totalDistanceM > 0 && (
          <div className={styles.countryBar} aria-hidden="true">
            {groups.map((g) => {
              // g.distanceM excludes the leg crossing INTO this group (groupByCountry
              // attributes that to entryLeg, not the group) — add it back so segment
              // widths sum to the route's real total instead of undercounting by
              // every border crossing.
              const segmentM = g.distanceM + (g.entryLeg?.distanceM ?? 0);
              return (
                <span
                  key={groupKey(g)}
                  className={styles.countryBarSegment}
                  style={{ width: `${(segmentM / route.totalDistanceM) * 100}%` }}
                />
              );
            })}
          </div>
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
