import { describe, it, expect } from 'vitest';
import { scanProse } from './scan-prose';

describe('scanProse', () => {
  it('extracts a simple capitalized name', () => {
    expect(scanProse('We started at Fushimi Inari before lunch.')).toContain('Fushimi Inari');
  });

  it('keeps a connector word inside a run', () => {
    expect(scanProse('We saw the Statue of Liberty at sunset.')).toContain('Statue of Liberty');
  });

  it('drops a trailing connector with nothing after it', () => {
    const out = scanProse('We walked to the Statue of the');
    expect(out).not.toContain('Statue of the');
    expect(out).toContain('Statue');
  });

  it('does not include a trailing sentence period in the phrase', () => {
    expect(scanProse('We visited Fushimi Inari.')).toContain('Fushimi Inari');
    expect(scanProse('We visited Fushimi Inari.')).not.toContain('Fushimi Inari.');
  });

  it('splits two names separated by lowercase text', () => {
    const out = scanProse('Fushimi Inari then Nishiki Market for lunch.');
    expect(out).toEqual(expect.arrayContaining(['Fushimi Inari', 'Nishiki Market']));
  });

  it('is loose enough to also catch non-places — filtering is not its job', () => {
    // Real filtering happens downstream in classify.ts against the geocoder's
    // response; this function only extracts capitalized runs. Adjacent capitals
    // merge into one run, so a sentence-initial "On Monday" comes out as a single
    // (bogus) phrase rather than being split from "Monday" — the geocoder simply
    // returns nothing usable for it.
    expect(scanProse('On Monday we saw Fushimi Inari.')).toEqual(
      expect.arrayContaining(['On Monday', 'Fushimi Inari']),
    );
  });

  it('does not merge two unrelated places joined by "and"', () => {
    expect(scanProse('We visited Tokyo and Kyoto.')).toEqual(
      expect.arrayContaining(['Tokyo', 'Kyoto']),
    );
  });

  it('handles accented and macron characters', () => {
    expect(scanProse('We visited Tōdai-ji.')).toContain('Tōdai-ji');
    expect(scanProse('We visited Dōtonbori.')).toContain('Dōtonbori');
  });

  it('dedupes repeated phrases', () => {
    expect(scanProse('Fushimi Inari is great. Fushimi Inari again tomorrow.')).toEqual([
      'Fushimi Inari',
    ]);
  });

  it('returns nothing for text with no capitals', () => {
    expect(scanProse('we had a quiet day at the market')).toEqual([]);
  });

  it('caps the number of phrases returned', () => {
    // Distinct spreadsheet-column-style suffixes (A, B, ... Z, AA, AB, ...) rather
    // than digits — scanProse only matches letters, so a digit suffix like "Place0"
    // would tokenize as the same word "Place" 80 times and collapse under dedup.
    const suffix = (n: number): string => {
      let s = '';
      let x = n + 1;
      while (x > 0) {
        x--;
        s = String.fromCharCode(65 + (x % 26)) + s;
        x = Math.floor(x / 26);
      }
      return s;
    };
    const text = Array.from({ length: 80 }, (_, i) => `Place ${suffix(i)}`).join('. ');
    expect(scanProse(text, 50)).toHaveLength(50);
  });
});
