import { describe, it, expect } from 'vitest';
import { pickPriorCandidateIndex, priorChoiceStorageKey } from './priorChoice';
import { candidateKey } from './candidateKey';
import type { Candidate } from '@/lib/types';

const kiyomizuDera: Candidate = {
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

const kiyomizuNeighbourhood: Candidate = {
  name: 'Kiyomizu',
  address: 'Kiyomizu, Naniwa-ku, Osaka',
  lat: 34.65,
  lon: 135.49,
  osm: { type: 'way', id: 111, class: 'place', tag: 'neighbourhood' },
  wikidata: null,
  wikipedia: null,
  importance: 0.4,
  class: 'place',
  tag: 'neighbourhood',
};

describe('priorChoiceStorageKey', () => {
  it('namespaces the normalized raw text', () => {
    expect(priorChoiceStorageKey('kiyomizu temple')).toBe('wanderlist:resolved:kiyomizu temple');
  });
});

describe('pickPriorCandidateIndex', () => {
  const candidates = [kiyomizuDera, kiyomizuNeighbourhood];

  it('finds the index of the stored candidate', () => {
    expect(pickPriorCandidateIndex(candidates, candidateKey(kiyomizuNeighbourhood))).toBe(1);
  });

  it('returns null when nothing is stored', () => {
    expect(pickPriorCandidateIndex(candidates, null)).toBeNull();
  });

  it("returns null when the stored key doesn't match any current candidate", () => {
    expect(pickPriorCandidateIndex(candidates, 'osm:way:999999')).toBeNull();
  });
});
