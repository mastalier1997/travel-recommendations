/**
 * Splits a solved stop order into maximal routable runs at gap boundaries, so the
 * caller can route each run with its own /route call and connect the boundaries
 * with a direct leg instead of one all-or-nothing call across the whole trip.
 * Pure: length + a gap predicate in, position-runs out — no ids, no fetch, same
 * discipline as solve.ts and reachability.ts.
 */

/**
 * `isGap(k)` tests the pair at positions (k, k+1) in the solved order, for
 * k in [0, n-2]. Returns arrays of POSITIONS (0-based, into whatever stop array
 * the caller solved), not stop ids or original indices — the caller maps back.
 */
export function splitIntoRuns(n: number, isGap: (k: number) => boolean): number[][] {
  if (n === 0) return [];
  const runs: number[][] = [];
  let current: number[] = [0];
  for (let k = 1; k < n; k++) {
    if (isGap(k - 1)) {
      runs.push(current);
      current = [k];
    } else {
      current.push(k);
    }
  }
  runs.push(current);
  return runs;
}
