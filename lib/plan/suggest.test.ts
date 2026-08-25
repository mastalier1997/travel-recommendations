import { describe, it, expect } from 'vitest';
import { corridorAroundStop, buildSuggestions } from './suggest';
import { place as makePlace } from '@/lib/fixtures/place';
import type { NearbyPoi } from '@/lib/types';

const place = (id: string, lat: number, lon: number, extra: Partial<Parameters<typeof makePlace>[0]> = {}) =>
  makePlace({ id, name: id, lat, lon, addedAt: '2026-01-01T00:00:00.000Z', ...extra });

describe('corridorAroundStop', () => {
  const places = [place('a', 0, 0), place('b', 0, 1), place('c', 0, 2), place('d', 0, 3), place('e', 0, 4)];

  it('windows around the anchor stop, legWindow on each side', () => {
    const corridor = corridorAroundStop(places, 'c', 1);
    expect(corridor).toEqual([
      [1, 0],
      [2, 0],
      [3, 0],
    ]);
  });

  it('clamps the window at the start/end of the itinerary', () => {
    expect(corridorAroundStop(places, 'a', 2)).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
  });

  it('defaults to the last confirmed stop when no anchor is given', () => {
    expect(corridorAroundStop(places, null, 1)).toEqual([
      [3, 0],
      [4, 0],
    ]);
  });

  it('skips places with no coordinates', () => {
    const withUnresolved = [...places, makePlace({ id: 'f', name: 'f', lat: null, lon: null, addedAt: '2026-01-01T00:00:00.000Z' })];
    expect(corridorAroundStop(withUnresolved, null, 1)).toEqual([
      [3, 0],
      [4, 0],
    ]);
  });

  it('returns an empty corridor with no confirmed places at all', () => {
    expect(corridorAroundStop([], null)).toEqual([]);
  });
});

describe('buildSuggestions', () => {
  const poi: NearbyPoi = {
    name: 'Nishiki Tenmangū Shrine',
    lat: 0.0005,
    lon: 1,
    osm: { type: 'node', id: 42, class: 'tourism', tag: 'shrine' },
    class: 'tourism',
    tag: 'shrine',
  };

  it('flags a POI within the already-added radius of a confirmed place', () => {
    const places = [place('a', 0, 1)]; // ~55m from the POI at (0.0005, 1), inside the 75m radius
    const [s] = buildSuggestions([poi], places, null);
    expect(s.alreadyAdded).toBe(true);
  });

  it('flags by matching OSM ref even if coordinates drifted', () => {
    const places = [place('a', 5, 5, { osm: { type: 'node', id: 42, class: 'tourism', tag: 'shrine' } })];
    const [s] = buildSuggestions([poi], places, null);
    expect(s.alreadyAdded).toBe(true);
  });

  it('does not flag an unrelated, distant place', () => {
    const places = [place('a', 40, 40)];
    const [s] = buildSuggestions([poi], places, null);
    expect(s.alreadyAdded).toBe(false);
  });

  it('derives a stable id from the OSM ref when present, else from coordinates', () => {
    const [withOsm] = buildSuggestions([poi], [], null);
    expect(withOsm.id).toBe('node:42');

    const noOsm: NearbyPoi = { ...poi, osm: null };
    const [withoutOsm] = buildSuggestions([noOsm], [], null);
    expect(withoutOsm.id).toBe(`${noOsm.name}:${noOsm.lat}:${noOsm.lon}`);
  });
});
