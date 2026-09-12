/**
 * Diagnoses whether a stop set contains a genuinely unsnappable coordinate, from
 * an unreachability mask that already came back from OSRM's /table (see
 * toTableResult in osrm.ts). No OSRM, no fetch: mask + ids in, a diagnosis (or
 * null) out — same discipline as solve.ts, and directly unit-testable against
 * hand-built masks.
 *
 * A stop set that merely splits into ≥2 road-connected groups (mainland vs. an
 * island chain, say) is NOT diagnosed here — that's normal, direct-line-routable
 * content now (see fuseMatrix.ts), not something to flag. This only flags a stop
 * that's cut off from EVERYTHING: singleton against a real (>=2-stop) majority.
 * An all-singleton graph (nobody connects to anybody, including the 2-stop case)
 * is indistinguishable from "everyone's on their own island" and is left alone.
 */

import type { UnreachableDiagnosis } from '@/lib/types';

/**
 * `mask[i][j] === true` means OSRM returned null for i -> j. Connectivity is
 * weak/symmetrized — a pair counts as connected if EITHER direction is real —
 * matching the symmetrization solve.ts already applies to its cost matrix. This
 * under-reports disconnection rather than over-reports it: a pair that's only
 * one-way unreachable still might resolve via /route on the solved order, so it
 * must not be flagged here.
 */
export function diagnoseUnreachable(stopIds: string[], mask: boolean[][]): UnreachableDiagnosis | null {
  const n = stopIds.length;
  if (n < 2 || mask.length !== n) return null;

  const connected = (i: number, j: number) => !mask[i][j] || !mask[j][i];
  const components = connectedComponents(n, connected);
  if (components.length < 2) return null;

  const groups = components.map((c) => c.map((i) => stopIds[i])).sort((a, b) => b.length - a.length);
  const [largest, ...minorities] = groups;

  // A singleton minority against a real majority is cut off from EVERYTHING, not
  // just from one side of a split — the one case worth flagging. Report the
  // first one found; the user fixes it and re-runs to see the next, if any.
  if (largest.length >= 2) {
    const isolated = minorities.find((g) => g.length === 1);
    if (isolated) return { stopId: isolated[0] };
  }

  return null;
}

function connectedComponents(n: number, connected: (i: number, j: number) => boolean): number[][] {
  const seen = new Array(n).fill(false);
  const components: number[][] = [];
  for (let start = 0; start < n; start++) {
    if (seen[start]) continue;
    seen[start] = true;
    const stack = [start];
    const component: number[] = [];
    while (stack.length) {
      const i = stack.pop() as number;
      component.push(i);
      for (let j = 0; j < n; j++) {
        if (!seen[j] && connected(i, j)) {
          seen[j] = true;
          stack.push(j);
        }
      }
    }
    components.push(component);
  }
  return components;
}
