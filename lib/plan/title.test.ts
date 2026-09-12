import { describe, it, expect } from 'vitest';
import { normalizeTitle } from './title';

describe('normalizeTitle', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeTitle('  Japan 2026  ')).toEqual({ ok: true, title: 'Japan 2026' });
  });

  it('caps at 120 characters', () => {
    const long = 'a'.repeat(150);
    const result = normalizeTitle(long);
    expect(result).toEqual({ ok: true, title: 'a'.repeat(120) });
  });

  it('rejects an empty string as invalid, not a silent substitution', () => {
    expect(normalizeTitle('')).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects a whitespace-only string the same way', () => {
    expect(normalizeTitle('   ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects a string that is only whitespace past the 120-char cap', () => {
    // Trim happens before the cap, so this isn't actually reachable via slicing
    // whitespace into content — pinned so the order of operations stays correct.
    expect(normalizeTitle(' '.repeat(200))).toEqual({ ok: false, reason: 'empty' });
  });
});
