import { describe, it, expect } from 'vitest';
import { diagnoseUnreachable } from './reachability';

const reachableMask = (n: number) =>
  Array.from({ length: n }, () => new Array(n).fill(false));

describe('diagnoseUnreachable', () => {
  it('returns null when every pair is reachable', () => {
    expect(diagnoseUnreachable(['a', 'b', 'c'], reachableMask(3))).toBeNull();
  });

  it('flags a single stop cut off from everyone else as isolated', () => {
    // b<->everything is null both ways; a<->c stays fine.
    const mask = reachableMask(3);
    mask[0][1] = mask[1][0] = true;
    mask[1][2] = mask[2][1] = true;
    const result = diagnoseUnreachable(['a', 'b', 'c'], mask);
    expect(result).toEqual({ kind: 'isolated', confident: true, stopIds: ['b'] });
  });

  it('does not call a stop isolated if only ONE direction is unreachable', () => {
    // a->b is null but b->a works — weak/symmetrized connectivity treats this pair
    // as still connected, since /route might still traverse it the working way.
    const mask = reachableMask(3);
    mask[0][1] = true; // a -> b null, b -> a fine
    const result = diagnoseUnreachable(['a', 'b', 'c'], mask);
    expect(result).toBeNull();
  });

  it('flags a real split (e.g. mainland vs. islands) as split, not isolated', () => {
    // {a,b} connected to each other, {c,d} connected to each other, nothing crosses.
    const mask = reachableMask(4);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const sameSide = (i < 2 && j < 2) || (i >= 2 && j >= 2);
        if (!sameSide && i !== j) mask[i][j] = true;
      }
    }
    const result = diagnoseUnreachable(['a', 'b', 'c', 'd'], mask);
    expect(result).toEqual({
      kind: 'split',
      confident: false,
      stopIds: ['c', 'd'],
      groups: [
        ['a', 'b'],
        ['c', 'd'],
      ],
    });
  });

  it('a 2-stop trip is a symmetric split, never an isolated single stop', () => {
    const mask = reachableMask(2);
    mask[0][1] = mask[1][0] = true;
    const result = diagnoseUnreachable(['kl', 'jakarta'], mask);
    expect(result).toEqual({
      kind: 'split',
      confident: false,
      stopIds: ['jakarta'],
      groups: [['kl'], ['jakarta']],
    });
  });

  it('flags every independently-isolated stop as isolated, even with 3+ components', () => {
    // {a,b,c} (indices 0-2) stay mutually reachable (default false); d (3) and e (4)
    // are each cut off from everyone, including each other — two separately
    // stranded stops, not a d/e pair of their own.
    const mask = reachableMask(5);
    for (let i = 0; i < 5; i++) {
      for (let j = 3; j < 5; j++) {
        if (i === j) continue;
        mask[i][j] = mask[j][i] = true;
      }
    }
    const result = diagnoseUnreachable(['a', 'b', 'c', 'd', 'e'], mask);
    expect(result).toEqual({ kind: 'isolated', confident: true, stopIds: ['d', 'e'] });
  });

  it('returns null for fewer than two stops or a mismatched mask', () => {
    expect(diagnoseUnreachable(['a'], reachableMask(1))).toBeNull();
    expect(diagnoseUnreachable(['a', 'b'], reachableMask(3))).toBeNull();
  });
});
