import { describe, it, expect } from 'vitest';
import { isSessionExpired, sessionAgeS, SESSION_MAX_AGE_S } from './session';

const NOW = 1_800_000_000;

describe('sessionAgeS', () => {
  it('reads the earliest amr entry, not the latest', () => {
    const claims = {
      amr: [
        { method: 'otp', timestamp: NOW - 1000 },
        { method: 'otp', timestamp: NOW - 10 },
      ],
    };
    expect(sessionAgeS(claims, NOW)).toBe(1000);
  });

  it('returns null with no amr claim, an empty array, or the RFC-8176 string format', () => {
    expect(sessionAgeS({}, NOW)).toBeNull();
    expect(sessionAgeS({ amr: [] }, NOW)).toBeNull();
    expect(sessionAgeS({ amr: ['otp'] }, NOW)).toBeNull();
  });
});

describe('isSessionExpired', () => {
  it('is false just under the cutoff and true just over it', () => {
    const justUnder = { amr: [{ method: 'otp', timestamp: NOW - (SESSION_MAX_AGE_S - 1) }] };
    const justOver = { amr: [{ method: 'otp', timestamp: NOW - (SESSION_MAX_AGE_S + 1) }] };
    expect(isSessionExpired(justUnder, NOW)).toBe(false);
    expect(isSessionExpired(justOver, NOW)).toBe(true);
  });

  it('treats an unreadable amr claim as not expired, not a crash', () => {
    expect(isSessionExpired({}, NOW)).toBe(false);
  });
});
