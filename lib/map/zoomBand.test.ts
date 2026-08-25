import { describe, it, expect } from 'vitest';
import { zoomBand } from './zoomBand';

describe('zoomBand', () => {
  it('close at city/metro zoom', () => {
    expect(zoomBand(12)).toBe('close');
    expect(zoomBand(9)).toBe('close');
  });

  it('regional between country and metro scale', () => {
    expect(zoomBand(8.9)).toBe('regional');
    expect(zoomBand(5)).toBe('regional');
  });

  it('continental below regional scale', () => {
    expect(zoomBand(4.9)).toBe('continental');
    expect(zoomBand(0)).toBe('continental');
  });
});
