import { describe, it, expect } from 'vitest';
import { applyResult, decideSave, shouldRetryAfterInFlight, shouldSave, type SaveState } from './saveState';

const base = { enabled: true, primed: true, paused: false, status: 'idle' as const };

describe('shouldSave', () => {
  it('saves an ordinary edit', () => {
    expect(shouldSave(base)).toBe(true);
  });

  it('never saves in fixture mode', () => {
    expect(shouldSave({ ...base, enabled: false })).toBe(false);
  });

  it('does not save the initial load', () => {
    expect(shouldSave({ ...base, primed: false })).toBe(false);
  });

  it('does not save mid-drag', () => {
    expect(shouldSave({ ...base, paused: true })).toBe(false);
  });

  it('stops permanently after a conflict', () => {
    expect(shouldSave({ ...base, status: 'conflict' })).toBe(false);
  });

  it('keeps trying after a transient error', () => {
    expect(shouldSave({ ...base, status: 'error' })).toBe(true);
  });
});

describe('applyResult', () => {
  const current: SaveState = { status: 'saving', version: 4, error: null };

  it('advances the version on success', () => {
    expect(applyResult(current, { ok: true, version: 5 })).toEqual({
      status: 'saved',
      version: 5,
      error: null,
    });
  });

  it('holds the version on conflict so nothing is written under a wrong number', () => {
    const next = applyResult(current, { ok: false, conflict: true });
    expect(next.status).toBe('conflict');
    expect(next.version).toBe(4);
  });

  it('surfaces the error text and keeps the version', () => {
    const next = applyResult(current, { ok: false, error: 'network down' });
    expect(next).toEqual({ status: 'error', version: 4, error: 'network down' });
  });

  it('a recovered save clears the previous error', () => {
    const errored = applyResult(current, { ok: false, error: 'network down' });
    expect(applyResult(errored, { ok: true, version: 5 }).error).toBeNull();
  });
});

describe('decideSave', () => {
  const inFlightBase = { ...base, inFlight: false };

  it('saves an ordinary edit', () => {
    expect(decideSave(inFlightBase)).toBe('save');
  });

  it('skips exactly when shouldSave would', () => {
    expect(decideSave({ ...inFlightBase, enabled: false })).toBe('skip');
    expect(decideSave({ ...inFlightBase, primed: false })).toBe('skip');
    expect(decideSave({ ...inFlightBase, paused: true })).toBe('skip');
    expect(decideSave({ ...inFlightBase, status: 'conflict' })).toBe('skip');
  });

  it('defers — does not drop — an edit that arrives while a save is in flight', () => {
    expect(decideSave({ ...inFlightBase, inFlight: true })).toBe('defer');
  });

  it('still skips an in-flight edit once the plan is in conflict', () => {
    // skip wins over defer — retrying into a known conflict would just replay the
    // same lost race.
    expect(decideSave({ ...inFlightBase, inFlight: true, status: 'conflict' })).toBe('skip');
  });
});

describe('shouldRetryAfterInFlight', () => {
  it('retries a deferred edit once the in-flight save lands', () => {
    expect(shouldRetryAfterInFlight(true, 'saved')).toBe(true);
  });

  it('retries after a transient error too', () => {
    expect(shouldRetryAfterInFlight(true, 'error')).toBe(true);
  });

  it('does not retry into a conflict', () => {
    expect(shouldRetryAfterInFlight(true, 'conflict')).toBe(false);
  });

  it('does nothing when nothing was deferred', () => {
    expect(shouldRetryAfterInFlight(false, 'saved')).toBe(false);
  });
});
