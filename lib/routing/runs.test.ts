import { describe, it, expect } from 'vitest';
import { splitIntoRuns } from './runs';

describe('splitIntoRuns', () => {
  it('returns one run spanning everything when there are no gaps', () => {
    expect(splitIntoRuns(4, () => false)).toEqual([[0, 1, 2, 3]]);
  });

  it('splits at a single gap boundary', () => {
    // gap between positions 1 and 2
    expect(splitIntoRuns(4, (k) => k === 1)).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it('splits at multiple gap boundaries, including adjacent ones (a lone stranded stop)', () => {
    // gaps at k=0 and k=1 -> position 1 is its own single-stop run
    expect(splitIntoRuns(4, (k) => k === 0 || k === 1)).toEqual([[0], [1], [2, 3]]);
  });

  it('handles n=0 and n=1', () => {
    expect(splitIntoRuns(0, () => false)).toEqual([]);
    expect(splitIntoRuns(1, () => false)).toEqual([[0]]);
  });

  it('every position appears exactly once, in order, across all runs', () => {
    const n = 7;
    const gapAt = new Set([2, 4, 5]);
    const runs = splitIntoRuns(n, (k) => gapAt.has(k));
    expect(runs.flat()).toEqual(Array.from({ length: n }, (_, i) => i));
  });
});
