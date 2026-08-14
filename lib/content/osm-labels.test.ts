import { describe, it, expect } from 'vitest';
import { labelForOsmTag } from './osm-labels';

describe('labelForOsmTag', () => {
  it('returns the specific class/tag label when known', () => {
    expect(labelForOsmTag('historic', 'temple')).toBe('Temple');
    expect(labelForOsmTag('amenity', 'restaurant')).toBe('Restaurant');
    expect(labelForOsmTag('natural', 'wood')).toBe('Forest');
  });

  it('falls back to the class-level label for an untracked tag', () => {
    expect(labelForOsmTag('tourism', 'some_new_osm_tag')).toBe('Attraction');
    expect(labelForOsmTag('amenity', 'something_unlisted')).toBe('Venue');
  });

  it('titlecases the raw tag for a wholly unknown class', () => {
    expect(labelForOsmTag('shop', 'convenience')).toBe('Convenience');
    expect(labelForOsmTag('shop', 'wine_and_spirits')).toBe('Wine and spirits');
  });

  it('returns null when there is nothing to show at all', () => {
    expect(labelForOsmTag('shop', '')).toBeNull();
  });

  it('covers every top-level PLACE_CLASSES entry with a fallback', () => {
    for (const cls of ['tourism', 'historic', 'natural', 'leisure', 'amenity', 'place']) {
      expect(labelForOsmTag(cls, 'totally_unlisted_tag')).not.toBeNull();
    }
  });
});
