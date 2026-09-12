/**
 * Fills the gaps in an OSRM /table distance matrix (lib/routing/osrm.ts's
 * `unreachable` mask) with straight-line estimates, so the solver (solve.ts) can
 * route across a road gap instead of refusing. Pure: matrix + mask + coordinates
 * in, plain data out — same discipline as solve.ts and reachability.ts.
 */

import { haversineDistance } from './haversine';

/** A great-circle line is systematically shorter than any real crossing (ferry,
 * flight, or a long drive around) — without a penalty the solver would prefer
 * hopping water over a perfectly good road that goes around it. This inflates the
 * estimate it solves on (never the distance actually shown to the user — see
 * `gapDistances` below, which stays the honest raw value). */
const GAP_CIRCUITY_FACTOR = 1.35;
/** Added on top of the (circuity-adjusted) travel-time estimate — represents
 * generic crossing/terminal overhead (a ferry or flight isn't door-to-door).
 * Large enough that the solver minimizes the NUMBER of crossings rather than
 * treating them as free, so an island-hopping stop set comes out grouped
 * island-by-island with as few crossings as the geography allows. Tunable. */
const GAP_FIXED_COST_S = 4 * 3600;
/** A generic cross-gap pace for the solver's own cost estimate only — never
 * shown to the user, who never sees a "speed" for a leg with no real transit. */
const GAP_NOMINAL_SPEED_MPS = (60 * 1000) / 3600;

export type FusedMatrix = {
  /** Feed this to solveOrder. Real OSRM durations where a road route exists;
   * a penalized haversine estimate (see above) for every gap cell — filled in
   * BOTH directions whenever either direction was unreachable, so solve.ts's own
   * symmetrization never averages a real duration with a synthetic one. */
  solveDurations: number[][];
  /** The honest, unpenalized straight-line distance for every gap cell — this,
   * never `solveDurations`, is what a direct leg's `distanceM` must come from. */
  gapDistances: number[][];
};

export function fuseMatrix(
  durations: number[][],
  unreachable: boolean[][],
  stops: { lat: number; lon: number }[],
): FusedMatrix {
  const n = stops.length;
  const solveDurations = durations.map((row) => [...row]);
  const gapDistances: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!unreachable[i][j] && !unreachable[j][i]) continue;
      const raw = haversineDistance(stops[i], stops[j]);
      const estimate = (raw / GAP_NOMINAL_SPEED_MPS) * GAP_CIRCUITY_FACTOR + GAP_FIXED_COST_S;
      gapDistances[i][j] = raw;
      gapDistances[j][i] = raw;
      solveDurations[i][j] = estimate;
      solveDurations[j][i] = estimate;
    }
  }

  return { solveDurations, gapDistances };
}
