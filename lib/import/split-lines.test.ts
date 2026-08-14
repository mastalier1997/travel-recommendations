import { describe, it, expect } from 'vitest';
import { splitLines } from './split-lines';

describe('splitLines', () => {
  it('passes plain lines through unchanged', () => {
    expect(splitLines('Fushimi Inari\nNishiki Market')).toEqual([
      'Fushimi Inari',
      'Nishiki Market',
    ]);
  });

  it('strips dash, asterisk and bullet markers', () => {
    expect(splitLines('- Fushimi Inari\n* Nishiki Market\n• Dotonbori')).toEqual([
      'Fushimi Inari',
      'Nishiki Market',
      'Dotonbori',
    ]);
  });

  it('strips markdown headings of any level', () => {
    expect(splitLines('# Kyoto\n## Fushimi Inari\n###### Deep heading')).toEqual([
      'Kyoto',
      'Fushimi Inari',
      'Deep heading',
    ]);
  });

  it('strips numbered list markers, both styles', () => {
    expect(splitLines('1. Fushimi Inari\n2) Nishiki Market')).toEqual([
      'Fushimi Inari',
      'Nishiki Market',
    ]);
  });

  it('strips only one layer of prefix, not nested', () => {
    // A second-level bullet under a first: the outer marker plus leading space is
    // consumed, the inner dash is left for the geocoder/user to deal with.
    expect(splitLines('  - - Nested Place')).toEqual(['- Nested Place']);
  });

  it('drops blank lines and trims surrounding whitespace', () => {
    expect(splitLines('  Fushimi Inari  \n\n\n  Nishiki Market\n   \n')).toEqual([
      'Fushimi Inari',
      'Nishiki Market',
    ]);
  });

  it('does not touch a mid-line dash or comma', () => {
    expect(splitLines('Kobe beef district, Sannomiya\nDōtonbori - after dark')).toEqual([
      'Kobe beef district, Sannomiya',
      'Dōtonbori - after dark',
    ]);
  });

  it('handles CRLF and lone CR line endings', () => {
    expect(splitLines('A\r\nB\rC')).toEqual(['A', 'B', 'C']);
  });

  it('returns an empty array for empty or whitespace-only input', () => {
    expect(splitLines('')).toEqual([]);
    expect(splitLines('   \n  \n')).toEqual([]);
  });
});
