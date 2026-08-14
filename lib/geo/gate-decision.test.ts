import { describe, it, expect } from 'vitest';
import { decideWait, MAX_WAIT_MS } from './gate-decision';

const at = (ms: number) => new Date(ms);

describe('decideWait', () => {
  it('proceeds immediately when the slot is in the past', () => {
    expect(decideWait(at(0), at(100))).toEqual({ action: 'proceed' });
  });

  it('proceeds when the slot is exactly now', () => {
    expect(decideWait(at(100), at(100))).toEqual({ action: 'proceed' });
  });

  it('sleeps for the remaining time when the wait is short', () => {
    expect(decideWait(at(1500), at(1000))).toEqual({ action: 'sleep', ms: 500 });
  });

  it('sleeps right up to the boundary, inclusive', () => {
    expect(decideWait(at(MAX_WAIT_MS), at(0))).toEqual({ action: 'sleep', ms: MAX_WAIT_MS });
  });

  it('bails just past the boundary, with the real wait as retryAfterMs', () => {
    expect(decideWait(at(MAX_WAIT_MS + 1), at(0))).toEqual({
      action: 'bail',
      retryAfterMs: MAX_WAIT_MS + 1,
    });
  });

  it('bails on a deeply queued slot', () => {
    const decision = decideWait(at(60_000), at(0));
    expect(decision).toEqual({ action: 'bail', retryAfterMs: 60_000 });
  });
});
