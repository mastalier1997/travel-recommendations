import { describe, it, expect } from 'vitest';
import type { Route, RouteLeg } from '@/lib/types';
import { groupByCountry } from './groupByCountry';
import { place } from '@/lib/fixtures/place';

const AT = '2026-08-02T09:00:00.000Z';

const p = (id: string, countryCode: string | null) =>
  place({ id, name: id, lat: 0, lon: 0, addedAt: AT, countryCode });

const leg = (fromId: string, toId: string, distanceM: number, durationS: number): RouteLeg => ({
  fromId,
  toId,
  distanceM,
  durationS,
});

const routeWithLegs = (legs: RouteLeg[]): Route => ({
  version: 1,
  provider: 'osrm',
  mode: 'driving',
  roundTrip: false,
  optimized: false,
  orderHash: 'x',
  legs,
  totalDistanceM: legs.reduce((s, l) => s + l.distanceM, 0),
  totalDurationS: legs.reduce((s, l) => s + l.durationS, 0),
  geometry: { type: 'LineString', coordinates: [] },
  computedAt: AT,
});

describe('groupByCountry', () => {
  it('returns one group per run of consecutive places sharing a country', () => {
    const places = [p('a', 'AT'), p('b', 'AT'), p('c', 'DE'), p('d', 'DE')];
    const groups = groupByCountry(places, null);
    expect(groups.map((g) => g.countryCode)).toEqual(['AT', 'DE']);
    expect(groups[0].places.map((pl) => pl.id)).toEqual(['a', 'b']);
    expect(groups[1].places.map((pl) => pl.id)).toEqual(['c', 'd']);
  });

  it('splits into a new group when the same country recurs non-consecutively', () => {
    const places = [p('a', 'AT'), p('b', 'DE'), p('c', 'AT')];
    const groups = groupByCountry(places, null);
    expect(groups.map((g) => g.countryCode)).toEqual(['AT', 'DE', 'AT']);
  });

  it('buckets places with no countryCode under a shared null group', () => {
    const places = [p('a', null), p('b', null)];
    const groups = groupByCountry(places, null);
    expect(groups).toHaveLength(1);
    expect(groups[0].countryLabel).toBe('Unknown');
  });

  it('sums only internal legs into distanceM/durationS, excluding the entry leg', () => {
    const places = [p('a', 'AT'), p('b', 'AT'), p('c', 'DE')];
    const route = routeWithLegs([leg('a', 'b', 100, 60), leg('b', 'c', 900, 900)]);
    const groups = groupByCountry(places, route);
    expect(groups[0].distanceM).toBe(100);
    expect(groups[0].durationS).toBe(60);
    expect(groups[0].entryLeg).toBeNull();
    expect(groups[1].distanceM).toBe(0);
    expect(groups[1].entryLeg).toEqual(leg('b', 'c', 900, 900));
  });

  it('records startIndex against the flat places array', () => {
    const places = [p('a', 'AT'), p('b', 'AT'), p('c', 'DE')];
    const groups = groupByCountry(places, null);
    expect(groups[0].startIndex).toBe(0);
    expect(groups[1].startIndex).toBe(2);
  });

  it('returns an empty array for an empty plan', () => {
    expect(groupByCountry([], null)).toEqual([]);
  });

  it('resolves a country label via Intl.DisplayNames', () => {
    const groups = groupByCountry([p('a', 'IT')], null);
    expect(groups[0].countryLabel).toBe('Italy');
  });
});
