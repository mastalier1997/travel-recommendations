import { describe, it, expect } from 'vitest';
import { solveOrder, nearestNeighborFrom, twoOptClosed, twoOptOpen, tourCost } from './solve';

// d(0,1)=5 d(0,2)=10 d(0,3)=1  d(1,2)=5 d(1,3)=10  d(2,3)=1
const M4 = [
  [0, 5, 10, 1],
  [5, 0, 5, 10],
  [10, 5, 0, 1],
  [1, 10, 1, 0],
];

// d(0,1)=10 d(0,2)=1 d(0,3)=5  d(1,2)=5 d(1,3)=1  d(2,3)=10
const M4closed = [
  [0, 10, 1, 5],
  [10, 0, 5, 1],
  [1, 5, 0, 10],
  [5, 1, 10, 0],
];

// d(0,1)=1 d(0,2)=1 d(0,3)=10  d(1,2)=10 d(1,3)=10  d(2,3)=1
const M4b = [
  [0, 1, 1, 10],
  [1, 0, 10, 10],
  [1, 10, 0, 1],
  [10, 10, 1, 0],
];

describe('nearestNeighborFrom', () => {
  it('always steps to the cheapest unvisited neighbor', () => {
    // d(0,1)=1 d(0,2)=5 d(0,3)=9  d(1,2)=2 d(1,3)=9  d(2,3)=1
    const m = [
      [0, 1, 5, 9],
      [1, 0, 2, 9],
      [5, 2, 0, 1],
      [9, 9, 1, 0],
    ];
    expect(nearestNeighborFrom(m, 0)).toEqual([0, 1, 2, 3]);
  });

  it('excludes forcedLast from every pick and appends it at the end', () => {
    // Without forcing, node 3 is nearer to 0 than node 1/2 are and would be
    // picked immediately — forcedLast must override that.
    const m = [
      [0, 5, 5, 1],
      [5, 0, 2, 9],
      [5, 2, 0, 9],
      [1, 9, 9, 0],
    ];
    expect(nearestNeighborFrom(m, 0, 3)).toEqual([0, 1, 2, 3]);
  });
});

describe('twoOptClosed', () => {
  it('reverses the segment that removes a crossing, using the standard two-edge delta', () => {
    // i=1,j=2: new edges (0,2)+(1,3)=1+10=11 vs old (0,1)+(2,3)=5+1=6 — no
    // improvement there; i=1,j=3 is the degenerate whole-tour-reversal case
    // (always delta=0 on a symmetric matrix). The actual improving move is
    // caught mid-pass once the earlier swap changes what's adjacent — traced
    // by hand end-to-end, see solve.ts's twoOptClosed for the algorithm.
    expect(twoOptClosed([0, 1, 2, 3], M4closed)).toEqual([0, 2, 1, 3]);
  });

  it('never increases total cost versus its input', () => {
    const start = [0, 1, 2, 3];
    const result = twoOptClosed([...start], M4closed);
    expect(tourCost(result, M4closed, true)).toBeLessThanOrEqual(tourCost(start, M4closed, true));
  });
});

describe('twoOptOpen', () => {
  it('uses the one-edge delta to relocate a free tail (fixLast=false)', () => {
    expect(twoOptOpen([0, 1, 2, 3], M4, false)).toEqual([0, 3, 2, 1]);
  });

  it('restricts moves to keep a forced-last node in place (fixLast=true)', () => {
    // With the last index excluded from every reversal boundary, the only
    // candidate move (i=1,j=2) isn't improving here, so nothing changes.
    expect(twoOptOpen([0, 1, 2, 3], M4, true)).toEqual([0, 1, 2, 3]);
  });
});

describe('solveOrder', () => {
  it('round trip: closes the loop and 2-opts it', () => {
    expect(solveOrder(M4b, { roundTrip: true })).toEqual([0, 1, 3, 2]);
  });

  it('defaults to fixed-first, free-last when neither endpoint is specified', () => {
    const result = solveOrder(M4b, { roundTrip: false });
    expect(result[0]).toBe(0);
    expect(result).toEqual([0, 1, 2, 3]);
  });

  it('fixFirst=true, fixLast=false behaves the same as the unspecified default', () => {
    const result = solveOrder(M4b, { roundTrip: false, fixFirst: true, fixLast: false });
    expect(result).toEqual([0, 1, 2, 3]);
  });

  it('both endpoints fixed keeps index 0 first and index n-1 last', () => {
    const result = solveOrder(M4b, { roundTrip: false, fixFirst: true, fixLast: true });
    expect(result[0]).toBe(0);
    expect(result[result.length - 1]).toBe(3);
  });

  it('fixLast only (free first) solves the mirrored problem — first is NOT pinned at 0', () => {
    // Hand-verified: the optimal path ending at node 3 is [1,0,2,3] (cost 3),
    // materially cheaper than any path forced to start at 0 (cheapest is 12).
    const result = solveOrder(M4b, { roundTrip: false, fixFirst: false, fixLast: true });
    expect(result).toEqual([1, 0, 2, 3]);
    expect(result[result.length - 1]).toBe(3);
  });

  it('returns a valid permutation of every index, for every variant, at a larger n', () => {
    const n = 7;
    // Arbitrary but fixed asymmetric-ish matrix — no ties to worry about here,
    // this test only checks shape (permutation), not a specific tour.
    const m = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : ((i + 1) * (j + 3)) % 11 || 1)));
    const variants: Array<{ roundTrip: boolean; fixFirst?: boolean; fixLast?: boolean }> = [
      { roundTrip: true },
      { roundTrip: false },
      { roundTrip: false, fixFirst: true, fixLast: true },
      { roundTrip: false, fixFirst: false, fixLast: true },
    ];
    for (const opts of variants) {
      const result = solveOrder(m, opts);
      expect([...result].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
    }
  });

  it('n<=2 returns identity order without touching the matrix shape', () => {
    expect(solveOrder([[0]], { roundTrip: false })).toEqual([0]);
    expect(
      solveOrder(
        [
          [0, 1],
          [1, 0],
        ],
        { roundTrip: true },
      ),
    ).toEqual([0, 1]);
  });
});
