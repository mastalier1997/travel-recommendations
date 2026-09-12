import { describe, it, expect } from 'vitest';
import { fuseMatrix } from './fuseMatrix';
import { haversineDistance } from './haversine';
import { solveOrder } from './solve';

const noGaps = (n: number) => Array.from({ length: n }, () => new Array(n).fill(false));

describe('fuseMatrix', () => {
  it('leaves a fully-reachable matrix untouched', () => {
    const durations = [
      [0, 100, 200],
      [100, 0, 150],
      [200, 150, 0],
    ];
    const stops = [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 0, lon: 2 }];
    const { solveDurations, gapDistances } = fuseMatrix(durations, noGaps(3), stops);
    expect(solveDurations).toEqual(durations);
    expect(gapDistances).toEqual([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
  });

  it('fills a gap cell with a penalized haversine estimate, both directions, even if only one was null', () => {
    const durations = [
      [0, Number.MAX_SAFE_INTEGER],
      [500, 0], // b -> a happens to have a real value; a -> b is the null one
    ];
    const mask = [
      [false, true],
      [false, false],
    ];
    const stops = [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }];
    const { solveDurations, gapDistances } = fuseMatrix(durations, mask, stops);

    // Both directions get the SAME synthetic estimate — never a real value
    // averaged against a synthetic one by solve.ts's own symmetrization.
    expect(solveDurations[0][1]).toBe(solveDurations[1][0]);
    expect(solveDurations[0][1]).toBeGreaterThan(0);
    expect(solveDurations[0][1]).not.toBe(Number.MAX_SAFE_INTEGER);

    const raw = haversineDistance(stops[0], stops[1]);
    expect(gapDistances[0][1]).toBeCloseTo(raw);
    expect(gapDistances[1][0]).toBeCloseTo(raw);
  });

  it('penalizes a gap enough that the solver crosses it once, not twice, when a real road exists on both sides', () => {
    // Two islands, two stops each, connected by a real cheap road; every
    // cross-island pair is a gap. A solver that ignored the crossing penalty
    // could zig-zag (A -> C -> B -> D) for a shorter total HAVERSINE distance;
    // the fixed cost must make staying on one island, crossing once, cheaper.
    const stops = [
      { lat: 0, lon: 0 }, // A
      { lat: 0, lon: 0.01 }, // B (very close to A)
      { lat: 0, lon: 10 }, // C
      { lat: 0, lon: 10.01 }, // D (very close to C)
    ];
    const REAL = 300; // A<->B and C<->D: a real 5-minute road each way
    const durations = [
      [0, REAL, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
      [REAL, 0, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
      [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 0, REAL],
      [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, REAL, 0],
    ];
    const mask = [
      [false, false, true, true],
      [false, false, true, true],
      [true, true, false, false],
      [true, true, false, false],
    ];

    const { solveDurations } = fuseMatrix(durations, mask, stops);
    const order = solveOrder(solveDurations, { roundTrip: false });

    // Exactly one boundary crossing between the {A,B} and {C,D} groups.
    const islandOf = (i: number) => (i < 2 ? 0 : 1);
    let crossings = 0;
    for (let k = 1; k < order.length; k++) {
      if (islandOf(order[k]) !== islandOf(order[k - 1])) crossings++;
    }
    expect(crossings).toBe(1);
  });
});
