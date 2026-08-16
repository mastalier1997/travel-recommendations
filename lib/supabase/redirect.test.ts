import { describe, it, expect } from 'vitest';
import { safeNext } from './redirect';

const ORIGIN = 'https://wanderlist.example';

describe('safeNext', () => {
  it('passes through a same-origin path with its query', () => {
    expect(safeNext('/plans/abc123?tab=map', ORIGIN)).toBe('/plans/abc123?tab=map');
  });

  it('falls back to /plans when next is missing', () => {
    expect(safeNext(null, ORIGIN)).toBe('/plans');
    expect(safeNext(undefined, ORIGIN)).toBe('/plans');
  });

  it('rejects a cross-origin target, including protocol-relative ones', () => {
    expect(safeNext('https://evil.example/plans', ORIGIN)).toBe('/plans');
    expect(safeNext('//evil.example/plans', ORIGIN)).toBe('/plans');
  });

  it('refuses to redirect back into the auth flow, which would loop', () => {
    expect(safeNext('/login', ORIGIN)).toBe('/plans');
    expect(safeNext('/login?reason=expired', ORIGIN)).toBe('/plans');
    expect(safeNext('/auth/callback', ORIGIN)).toBe('/plans');
  });

  it('falls back on a malformed absolute URL instead of throwing', () => {
    expect(safeNext('https://', ORIGIN)).toBe('/plans');
  });
});
