import { describe, it, expect } from 'vitest';
import { applyResult, shouldSave, type SaveState } from './saveState';

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
