import { describe, it, expect } from 'vitest';
import { buildQuery, toPois, validateNearbyRequest, MAX_CORRIDOR_POINTS, MAX_RADIUS_M } from './overpass';

describe('buildQuery', () => {
  it('buffers the whole corridor in one around filter per class', () => {
    const q = buildQuery(
      [
        [13.4, 52.5],
        [13.5, 52.6],
      ],
      500,
    );
    expect(q).toContain('around:500,52.5,13.4,52.6,13.5');
    expect(q).toContain('[tourism]');
    expect(q).toContain('[historic]');
  });
});

describe('toPois', () => {
  it('keeps only named nodes with a recognized PLACE_CLASSES tag', () => {
    const pois = toPois({
      elements: [
        { type: 'node', id: 1, lat: 1, lon: 2, tags: { name: 'Nishiki Market', tourism: 'yes' } },
        { type: 'node', id: 2, lat: 1, lon: 2, tags: { amenity: 'waste_basket' } }, // no name
        { type: 'way', id: 3, lat: 1, lon: 2, tags: { name: 'A road', highway: 'primary' } }, // not a node
        { type: 'node', id: 4, lat: 1, lon: 2, tags: { name: 'Untagged spot', shop: 'bakery' } }, // no PLACE_CLASSES key
      ],
    });
    expect(pois).toEqual([
      {
        name: 'Nishiki Market',
        lat: 1,
        lon: 2,
        osm: { type: 'node', id: 1, class: 'tourism', tag: 'yes' },
        class: 'tourism',
        tag: 'yes',
      },
    ]);
  });

  it('dedupes repeated element ids', () => {
    const el = { type: 'node', id: 1, lat: 1, lon: 2, tags: { name: 'X', natural: 'peak' } };
    expect(toPois({ elements: [el, el] })).toHaveLength(1);
  });
});

describe('validateNearbyRequest', () => {
  const okCorridor = [
    [13.4, 52.5],
    [13.5, 52.6],
  ];

  it('accepts a well-formed corridor and radius', () => {
    expect(validateNearbyRequest(okCorridor, 4000)).toEqual({ corridor: okCorridor, radiusM: 4000 });
  });

  it('rejects a non-array corridor', () => {
    expect(validateNearbyRequest('[[1,2]]', 4000)).toBeNull();
    expect(validateNearbyRequest(undefined, 4000)).toBeNull();
  });

  it('rejects an empty corridor', () => {
    expect(validateNearbyRequest([], 4000)).toBeNull();
  });

  it('rejects a corridor longer than MAX_CORRIDOR_POINTS', () => {
    const long = Array.from({ length: MAX_CORRIDOR_POINTS + 1 }, () => [0, 0]);
    expect(validateNearbyRequest(long, 4000)).toBeNull();
  });

  it('rejects a point that is not a finite [lon, lat] pair', () => {
    expect(validateNearbyRequest([[0, 0], ['x', 'y']], 4000)).toBeNull();
    expect(validateNearbyRequest([[0, 0], [200, 0]], 4000)).toBeNull(); // out-of-range longitude
    expect(validateNearbyRequest([[NaN, 0]], 4000)).toBeNull();
  });

  it('rejects a non-numeric, non-finite, zero, negative, or too-large radius', () => {
    expect(validateNearbyRequest(okCorridor, '4000')).toBeNull();
    expect(validateNearbyRequest(okCorridor, NaN)).toBeNull();
    expect(validateNearbyRequest(okCorridor, 0)).toBeNull();
    expect(validateNearbyRequest(okCorridor, -100)).toBeNull();
    expect(validateNearbyRequest(okCorridor, MAX_RADIUS_M + 1)).toBeNull();
  });

  it('this is exactly the request buildQuery would otherwise splice unescaped into Overpass QL', () => {
    // Documents the injection risk validateNearbyRequest exists to close.
    const malicious = "1,1);out;/*'--";
    expect(validateNearbyRequest(okCorridor, malicious)).toBeNull();
  });
});
