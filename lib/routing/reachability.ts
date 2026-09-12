/**
 * Diagnoses *why* a stop set is unroutable, from an unreachability mask that
 * already came back from OSRM's /table (see toTableResult in osrm.ts). No OSRM,
 * no fetch: mask + ids in, a diagnosis (or null) out — same discipline as
 * solve.ts, and directly unit-testable against hand-built masks.
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

  // Every minority a lone stop, against a real (>=2-stop) majority: each of them is
  // cut off from EVERYTHING, not just from one side of a split — confidently
  // 'isolated', however many there are (e.g. a mainland cluster plus two
  // independently-stranded stops). An all-singleton graph (including n===2, the
  // Kuala Lumpur/Jakarta case) has no real majority to be isolated FROM, so that
  // stays 'split': symmetric, nobody to blame.
  if (largest.length >= 2 && minorities.every((g) => g.length === 1)) {
    return { kind: 'isolated', confident: true, stopIds: minorities.flat() };
  }

  return {
    kind: 'split',
    confident: false,
    stopIds: minorities.flat(),
    groups,
  };
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
