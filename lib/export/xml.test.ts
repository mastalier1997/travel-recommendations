import { describe, it, expect } from 'vitest';
import { escapeXml } from './xml';

describe('escapeXml', () => {
  it('escapes all five XML-significant characters', () => {
    expect(escapeXml('& < > " \'')).toBe('&amp; &lt; &gt; &quot; &apos;');
  });

  it('escapes a real description containing an apostrophe', () => {
    expect(escapeXml("Tenryū-ji's garden")).toBe('Tenryū-ji&apos;s garden');
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeXml('Fushimi Inari Taisha')).toBe('Fushimi Inari Taisha');
  });
});
