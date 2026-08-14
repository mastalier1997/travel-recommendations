import { describe, it, expect } from 'vitest';
import { toCandidate, type NominatimResult } from './nominatim';

const base: NominatimResult = {
  osm_type: 'way',
  osm_id: 25778641,
  lat: '34.9949',
  lon: '135.785',
  category: 'historic',
  type: 'temple',
  importance: 0.71,
  name: 'Kiyomizu-dera',
  display_name: 'Kiyomizu-dera, 1-294 Kiyomizu, Higashiyama-ku, Kyoto, Japan',
  extratags: { wikidata: 'Q460584', wikipedia: 'en:Kiyomizu-dera' },
};

describe('toCandidate (Nominatim)', () => {
  it('maps a well-formed result', () => {
    expect(toCandidate(base)).toEqual({
      name: 'Kiyomizu-dera',
      address: 'Kiyomizu-dera, 1-294 Kiyomizu, Higashiyama-ku, Kyoto, Japan',
      lat: 34.9949,
      lon: 135.785,
      osm: { type: 'way', id: 25778641, class: 'historic', tag: 'temple' },
      wikidata: 'Q460584',
      wikipedia: 'en:Kiyomizu-dera',
      importance: 0.71,
      class: 'historic',
      tag: 'temple',
    });
  });

  it('parses lat/lon strings to numbers', () => {
    const c = toCandidate({ ...base, lat: '35.0116', lon: '-1.234' });
    expect(c.lat).toBe(35.0116);
    expect(c.lon).toBe(-1.234);
  });

  it('falls back to the first display_name segment when name is missing', () => {
    const c = toCandidate({ ...base, name: undefined });
    expect(c.name).toBe('Kiyomizu-dera');
  });

  it('falls back to the first segment when name is blank', () => {
    const c = toCandidate({ ...base, name: '   ' });
    expect(c.name).toBe('Kiyomizu-dera');
  });

  it('defaults importance to 0 when absent', () => {
    expect(toCandidate({ ...base, importance: undefined }).importance).toBe(0);
  });

  it('is null-safe on missing extratags', () => {
    const c = toCandidate({ ...base, extratags: undefined });
    expect(c.wikidata).toBeNull();
    expect(c.wikipedia).toBeNull();
  });

  it('is null-safe on an explicitly null extratags object', () => {
    const c = toCandidate({ ...base, extratags: null });
    expect(c.wikidata).toBeNull();
  });

  it('drops the OSM ref when osm_type is not one of node/way/relation', () => {
    expect(toCandidate({ ...base, osm_type: 'unexpected' }).osm).toBeNull();
  });

  it('drops the OSM ref when osm_id is missing', () => {
    expect(toCandidate({ ...base, osm_id: undefined }).osm).toBeNull();
  });

  it('accepts all three real OSM types', () => {
    expect(toCandidate({ ...base, osm_type: 'node' }).osm?.type).toBe('node');
    expect(toCandidate({ ...base, osm_type: 'relation' }).osm?.type).toBe('relation');
  });
});
