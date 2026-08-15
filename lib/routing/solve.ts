/**
 * Nearest-neighbor construction + 2-opt local search over a plain cost matrix.
 * No OSRM, no place ids — indices in, permutation of indices out. This is what
 * runs above OSRM_TRIP_MAX_STOPS instead of asking OSRM's own /trip solver
 * (see lib/routing/osrm.ts's requestSolvedRoute, which builds the matrix via
 * OSRM's cheap /table endpoint and maps these indices back to stops).
 *
 * Deterministic on purpose: fixed nested-loop order, strict tie-breaks, no
 * Math.random. Makes it directly unit-testable against hand-built matrices.
 */

export type SolveOptions = {
  roundTrip: boolean;
  fixFirst?: boolean;
  fixLast?: boolean;
};

const EPS = 1e-9;

export function solveOrder(rawMatrix: number[][], opts: SolveOptions): number[] {
  const n = rawMatrix.length;
  if (n <= 2) return Array.from({ length: n }, (_, i) => i);

  // Driving times/distances are asymmetric (one-ways); 2-opt's O(1) swap delta
  // only holds on a symmetric matrix, since reversing a segment flips every
  // interior edge. Symmetrize once; the caller's final geometry call (a real
  // OSRM /route over the solved order) is what produces authoritative totals —
  // this matrix only decides which order to try.
  const matrix = symmetrize(rawMatrix);

  if (opts.roundTrip) {
    return twoOptClosed(nearestNeighborFrom(matrix, 0), matrix);
  }

  if (!opts.fixFirst && opts.fixLast) {
    // Fixed-last, free-first: solve the mirror problem (fixed-first, free-last)
    // on the reversed matrix, then map the answer back. Reversing is an exact
    // relabeling, not an approximation — index i's distances become index
    // (n-1-i)'s, so a 2-opt-improved tour there maps to an equally-improved
    // tour here once both the indices AND the visiting order are flipped back.
    const reversed = reverseMatrix(matrix);
    const solved = solveOpenPath(reversed, false);
    return solved.map((i) => n - 1 - i).reverse();
  }

  // Neither endpoint fixed defaults to fixed-first — mirrors OSRM /trip's own
  // default (osrm.ts: "the demo server 400s on roundtrip=false with neither
  // endpoint fixed"). Also not a real loss of generality: an open path with
  // both ends free is symmetric under full reversal, so "start wherever NN's
  // first step lands" and "start at index 0" describe the same solution space.
  const fixLast = !!opts.fixFirst && !!opts.fixLast;
  return solveOpenPath(matrix, fixLast);
}

export function solveOpenPath(matrix: number[][], fixLast: boolean): number[] {
  // "Both fixed" needs NN to actually END at the last index, not just hope it
  // lands there — plain greedy has no notion that a particular node is supposed
  // to be saved for last, so without this it could visit it in the middle.
  const forcedLast = fixLast ? matrix.length - 1 : undefined;
  return twoOptOpen(nearestNeighborFrom(matrix, 0, forcedLast), matrix, fixLast);
}

/** Greedy construction: always step to the nearest unvisited node. Ties break
 * toward the lower index (ascending scan, strict `<`) — deterministic.
 * `forcedLast`, when given, is excluded from every greedy pick and appended
 * as the final step regardless of geometry — see solveOpenPath's fixLast case. */
export function nearestNeighborFrom(matrix: number[][], start: number, forcedLast?: number): number[] {
  const n = matrix.length;
  const visited = new Array(n).fill(false);
  const tour = [start];
  visited[start] = true;
  if (forcedLast !== undefined) visited[forcedLast] = true;

  for (let step = 1; step < n; step++) {
    if (step === n - 1 && forcedLast !== undefined) {
      tour.push(forcedLast);
      break;
    }
    const last = tour[tour.length - 1];
    let best = -1;
    let bestCost = Infinity;
    for (let j = 0; j < n; j++) {
      if (visited[j]) continue;
      const cost = matrix[last][j];
      if (cost < bestCost) {
        bestCost = cost;
        best = j;
      }
    }
    tour.push(best);
    visited[best] = true;
  }
  return tour;
}

/** Standard 2-opt over a closed loop (edges wrap n-1 → 0). Index 0 stays first
 * in the array but a cycle is rotation-invariant, so nothing is truly "pinned". */
export function twoOptClosed(tour: number[], matrix: number[][]): number[] {
  const n = tour.length;
  let passes = 0;
  let improved = true;

  while (improved && passes < n) {
    improved = false;
    passes++;
    for (let i = 1; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = tour[i - 1];
        const b = tour[i];
        const c = tour[j];
        const d = tour[(j + 1) % n];
        const delta = matrix[a][c] + matrix[b][d] - matrix[a][b] - matrix[c][d];
        if (delta < -EPS) {
          reverseSegment(tour, i, j);
          improved = true;
        }
      }
    }
  }
  return tour;
}

/**
 * 2-opt over an open path (no wraparound). `fixLast` toggles whether the last
 * node can ever move: when it's free, reversing all the way to the end removes
 * only ONE edge (there's no successor past the last node) instead of the usual
 * two-edge swap — that asymmetric case is what actually lets a free tail
 * relocate, and is the single easiest spot to get wrong.
 */
export function twoOptOpen(tour: number[], matrix: number[][], fixLast: boolean): number[] {
  const n = tour.length;
  const maxJ = fixLast ? n - 2 : n - 1;
  let passes = 0;
  let improved = true;

  while (improved && passes < n) {
    improved = false;
    passes++;
    for (let i = 1; i < n - 1; i++) {
      for (let j = i + 1; j <= maxJ; j++) {
        const a = tour[i - 1];
        const b = tour[i];

        if (j === n - 1 && !fixLast) {
          const c = tour[n - 1];
          const delta = matrix[a][c] - matrix[a][b];
          if (delta < -EPS) {
            reverseSegment(tour, i, j);
            improved = true;
          }
          continue;
        }

        const c = tour[j];
        const d = tour[j + 1];
        const delta = matrix[a][c] + matrix[b][d] - matrix[a][b] - matrix[c][d];
        if (delta < -EPS) {
          reverseSegment(tour, i, j);
          improved = true;
        }
      }
    }
  }
  return tour;
}

/** Sum of consecutive edge costs. `roundTrip` adds the closing edge back to tour[0]. */
export function tourCost(tour: number[], matrix: number[][], roundTrip: boolean): number {
  let total = 0;
  for (let k = 0; k < tour.length - 1; k++) total += matrix[tour[k]][tour[k + 1]];
  if (roundTrip && tour.length > 1) total += matrix[tour[tour.length - 1]][tour[0]];
  return total;
}

function reverseSegment(tour: number[], i: number, j: number): void {
  while (i < j) {
    const tmp = tour[i];
    tour[i] = tour[j];
    tour[j] = tmp;
    i++;
    j--;
  }
}

function symmetrize(matrix: number[][]): number[][] {
  const n = matrix.length;
  const out: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      out[i][j] = i === j ? 0 : (matrix[i][j] + matrix[j][i]) / 2;
    }
  }
  return out;
}

function reverseMatrix(matrix: number[][]): number[][] {
  const n = matrix.length;
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => matrix[n - 1 - i][n - 1 - j]));
}
