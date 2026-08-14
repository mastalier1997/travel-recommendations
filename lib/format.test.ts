import { describe, it, expect } from 'vitest';
import {
  formatDistance,
  formatDurationLong,
  formatDurationShort,
  formatDurationSpoken,
  formatDistanceSpoken,
} from './format';
import { SAMPLE_ROUTE } from '@/lib/fixtures/sample-plan';

describe('formatDistance', () => {
  it('uses metres below 1 km', () => {
    expect(formatDistance(800)).toBe('800 m');
  });
  it('uses one decimal below 10 km', () => {
    expect(formatDistance(5_400)).toBe('5.4 km');
    expect(formatDistance(9_949)).toBe('9.9 km');
  });
  it('rounds to whole km at or above 10', () => {
    expect(formatDistance(52_000)).toBe('52 km');
    expect(formatDistance(186_000)).toBe('186 km');
  });
});

describe('formatDuration', () => {
  it('renders the fixture total as the design shows it', () => {
    expect(formatDurationLong(SAMPLE_ROUTE.totalDurationS)).toBe('4h 20m');
  });
  it('keeps short legs in minutes', () => {
    expect(formatDurationShort(960)).toBe('16 min');
    expect(formatDurationShort(3_960)).toBe('66 min');
  });
  it('switches to hours past 90 minutes', () => {
    expect(formatDurationShort(5_400)).toBe('1h 30m');
  });
  it('drops the hour part below an hour', () => {
    expect(formatDurationLong(600)).toBe('10m');
  });
});

describe('spoken forms', () => {
  it('spells out units', () => {
    expect(formatDurationSpoken(SAMPLE_ROUTE.totalDurationS)).toBe('4 hours 20 minutes');
    expect(formatDurationSpoken(3_600)).toBe('1 hour');
    expect(formatDurationSpoken(0)).toBe('0 minutes');
    expect(formatDistanceSpoken(186_000)).toBe('186 kilometres');
    expect(formatDistanceSpoken(5_400)).toBe('5.4 kilometres');
  });
});

describe('summary bar matches the design', () => {
  it('renders "186 km" and "4h 20m" from the fixture', () => {
    expect(formatDistance(SAMPLE_ROUTE.totalDistanceM)).toBe('186 km');
    expect(formatDurationLong(SAMPLE_ROUTE.totalDurationS)).toBe('4h 20m');
  });
});
