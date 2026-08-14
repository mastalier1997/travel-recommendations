import { describe, it, expect } from 'vitest';
import { moveBy, moveTo, removeAt, insertAt, focusIndexAfterRemove } from './reorder';

const L = () => ['a', 'b', 'c', 'd'];

describe('moveBy', () => {
  it('moves up and down', () => {
    expect(moveBy(L(), 2, -1)).toEqual(['a', 'c', 'b', 'd']);
    expect(moveBy(L(), 1, 1)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('clamps at both ends instead of wrapping', () => {
    const l = L();
    expect(moveBy(l, 0, -1)).toBe(l); // same reference — nothing changed
    expect(moveBy(l, 3, 1)).toBe(l);
  });

  it('ignores out-of-range indices', () => {
    const l = L();
    expect(moveBy(l, -1, 1)).toBe(l);
    expect(moveBy(l, 9, -1)).toBe(l);
  });
});

describe('moveTo', () => {
  it('moves last to first', () => {
    expect(moveTo(L(), 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('moves first to last', () => {
    expect(moveTo(L(), 0, 3)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('is a no-op onto itself', () => {
    const l = L();
    expect(moveTo(l, 2, 2)).toBe(l);
  });

  it('does not mutate the input', () => {
    const l = L();
    moveTo(l, 0, 3);
    expect(l).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('removeAt / insertAt round-trip', () => {
  it('undo restores the original order', () => {
    const l = L();
    const removed = removeAt(l, 1);
    expect(removed).toEqual(['a', 'c', 'd']);
    expect(insertAt(removed, 1, 'b')).toEqual(l);
  });

  it('restores a removed last item', () => {
    const l = L();
    expect(insertAt(removeAt(l, 3), 3, 'd')).toEqual(l);
  });

  it('clamps an out-of-range insert', () => {
    expect(insertAt(['a'], 99, 'z')).toEqual(['a', 'z']);
  });
});

describe('focusIndexAfterRemove', () => {
  it('focuses the card that slid into the gap', () => {
    expect(focusIndexAfterRemove(2, 9)).toBe(2);
  });

  it('falls back to the new last card when the last was removed', () => {
    expect(focusIndexAfterRemove(8, 9)).toBe(7);
  });

  it('reports an empty list', () => {
    expect(focusIndexAfterRemove(0, 1)).toBe(-1);
  });
});
