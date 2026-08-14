import { describe, it, expect } from 'vitest';
import { slugify } from './filename';

describe('slugify', () => {
  it('lowercases and dashes a title with an en dash and spaces', () => {
    expect(slugify('Japan – Spring 2026')).toBe('japan-spring-2026');
  });

  it('strips diacritics', () => {
    expect(slugify('Tenryū-ji Garden')).toBe('tenryu-ji-garden');
  });

  it('falls back to "plan" for a title with nothing sluggable', () => {
    expect(slugify('   ')).toBe('plan');
  });
});
