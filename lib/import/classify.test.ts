import { describe, it, expect } from 'vitest';
import { classify } from './classify';
import type { Candidate } from '@/lib/types';

const cand = (over: Partial<Candidate> = {}): Candidate => ({
  name: 'Somewhere',
  address: 'Somewhere, Japan',
  lat: 34.9,
  lon: 135.7,
  osm: null,
  wikidata: null,
  wikipedia: null,
  importance: 0.5,
  class: 'tourism',
  tag: 'attraction',
  ...over,
});

describe('classify', () => {
  it('is none for zero candidates', () => {
    expect(classify([], false).state).toBe('none');
  });

  it('auto-accepts a lone confident hit', () => {
    const c = classify([cand({ importance: 0.71 })], false);
    expect(c).toMatchObject({ state: 'single', selectedIndex: 0, decision: 'accept' });
  });

  it('does not auto-accept a lone hit below the confidence bar', () => {
    const c = classify([cand({ importance: 0.2 })], false);
    expect(c).toMatchObject({ state: 'multiple', selectedIndex: null, decision: null });
  });

  it('is multiple for two or more hits regardless of importance', () => {
    const c = classify([cand({ importance: 0.9 }), cand({ importance: 0.8 })], false);
    expect(c.state).toBe('multiple');
  });

  it('leaves line-origin candidates unfiltered by OSM class', () => {
    const junk = cand({ class: 'boundary', tag: 'administrative', importance: 0.9 });
    expect(classify([junk], false).state).toBe('single');
  });

  it('filters prose-origin candidates to PLACE_CLASSES', () => {
    const junk = cand({ class: 'boundary', tag: 'administrative', importance: 0.9 });
    expect(classify([junk], true).state).toBe('none');
  });

  it('keeps a prose-origin candidate whose class is a real place type', () => {
    const good = cand({ class: 'historic', tag: 'shrine', importance: 0.71 });
    expect(classify([good], true).state).toBe('single');
  });

  it('can filter a mixed set down to a single usable candidate', () => {
    const junk = cand({ class: 'boundary', importance: 0.9 });
    const good = cand({ class: 'natural', importance: 0.71 });
    const c = classify([junk, good], true);
    expect(c).toMatchObject({ state: 'single', candidates: [good] });
  });
});
