import { describe, it, expect } from 'vitest';
import { candidateKey } from './candidateKey';
import type { Candidate } from '@/lib/types';

const base: Candidate = {
  name: 'Kiyomizu-dera',
  address: '1-294 Kiyomizu, Higashiyama-ku, Kyoto',
  lat: 34.9949,
  lon: 135.785,
  osm: { type: 'way', id: 25778641, class: 'historic', tag: 'temple' },
  wikidata: null,
  wikipedia: null,
  importance: 0.71,
  class: 'historic',
  tag: 'temple',
};

describe('candidateKey', () => {
  it('keys an OSM-backed candidate by its OSM ref', () => {
    expect(candidateKey(base)).toBe('osm:way:25778641');
  });

  it('falls back to name + address when there is no OSM ref', () => {
    expect(candidateKey({ ...base, osm: null })).toBe(
      'Kiyomizu-dera|1-294 Kiyomizu, Higashiyama-ku, Kyoto',
    );
  });

  it('gives two distinct OSM refs distinct keys', () => {
    const other: Candidate = { ...base, osm: { type: 'way', id: 999, class: 'place', tag: 'neighbourhood' } };
    expect(candidateKey(base)).not.toBe(candidateKey(other));
  });

  it('is stable for the same candidate shape', () => {
    expect(candidateKey(base)).toBe(candidateKey({ ...base }));
  });
});
