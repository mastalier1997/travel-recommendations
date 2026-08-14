import { describe, it, expect } from 'vitest';
import { toCandidate } from './maptiler';

describe('toCandidate (MapTiler)', () => {
  it('maps a well-formed feature using center', () => {
    const c = toCandidate({
      text: 'Kiyomizu-dera',
      place_name: 'Kiyomizu-dera, Kyoto, Japan',
      center: [135.785, 34.9949],
      relevance: 0.9,
      properties: { osm_id: 25778641, osm_type: 'way', categories: ['temple'] },
    });
    expect(c).toEqual({
      name: 'Kiyomizu-dera',
      address: 'Kiyomizu-dera, Kyoto, Japan',
      lat: 34.9949,
      lon: 135.785,
      osm: { type: 'way', id: 25778641, class: 'temple', tag: 'temple' },
      wikidata: null,
      wikipedia: null,
      importance: 0.9,
      class: 'temple',
      tag: 'temple',
    });
  });

  it('falls back to geometry.coordinates when center is absent', () => {
    const c = toCandidate({
      place_name: 'Somewhere, Japan',
      geometry: { coordinates: [135.5, 34.6] },
    });
    expect(c?.lat).toBe(34.6);
    expect(c?.lon).toBe(135.5);
  });

  it('returns null when neither center nor geometry is present', () => {
    expect(toCandidate({ place_name: 'Nowhere' })).toBeNull();
  });

  it('falls back to place_type when categories are absent', () => {
    const c = toCandidate({
      place_name: 'Somewhere, Japan',
      center: [1, 2],
      place_type: ['poi'],
    });
    expect(c?.class).toBe('poi');
  });

  it('falls back to "place" when neither categories nor place_type exist', () => {
    const c = toCandidate({ place_name: 'Somewhere, Japan', center: [1, 2] });
    expect(c?.class).toBe('place');
  });

  it('falls back to the first place_name segment when text is missing', () => {
    const c = toCandidate({ place_name: 'Kiyomizu-dera, Kyoto, Japan', center: [1, 2] });
    expect(c?.name).toBe('Kiyomizu-dera');
  });

  it('drops the OSM ref when osm fields are absent — this provider often lacks them', () => {
    const c = toCandidate({ place_name: 'Somewhere', center: [1, 2] });
    expect(c?.osm).toBeNull();
  });

  it('defaults importance to 0 when relevance is absent', () => {
    expect(toCandidate({ place_name: 'Somewhere', center: [1, 2] })?.importance).toBe(0);
  });
});
