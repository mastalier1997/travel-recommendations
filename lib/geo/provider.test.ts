import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { activeProvider } from './provider';

const ORIGINAL = { GEOCODER: process.env.GEOCODER, MAPTILER_KEY: process.env.MAPTILER_KEY };

function setEnv(v: { GEOCODER?: string; MAPTILER_KEY?: string }) {
  if (v.GEOCODER === undefined) delete process.env.GEOCODER;
  else process.env.GEOCODER = v.GEOCODER;
  if (v.MAPTILER_KEY === undefined) delete process.env.MAPTILER_KEY;
  else process.env.MAPTILER_KEY = v.MAPTILER_KEY;
}

beforeEach(() => setEnv({}));
afterEach(() => setEnv(ORIGINAL));

describe('activeProvider', () => {
  it('defaults to nominatim with no key and no override', () => {
    expect(activeProvider()).toBe('nominatim');
  });

  it('prefers maptiler once a key is present', () => {
    setEnv({ MAPTILER_KEY: 'test-key' });
    expect(activeProvider()).toBe('maptiler');
  });

  it('GEOCODER forces nominatim even with a key configured', () => {
    setEnv({ MAPTILER_KEY: 'test-key', GEOCODER: 'nominatim' });
    expect(activeProvider()).toBe('nominatim');
  });

  it('GEOCODER forces maptiler even with no key — a config error to surface at call time, not here', () => {
    setEnv({ GEOCODER: 'maptiler' });
    expect(activeProvider()).toBe('maptiler');
  });

  it('ignores a nonsense GEOCODER value and falls through to the key check', () => {
    setEnv({ GEOCODER: 'yahoo', MAPTILER_KEY: 'test-key' });
    expect(activeProvider()).toBe('maptiler');
  });
});
