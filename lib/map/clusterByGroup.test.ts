import { describe, it, expect } from 'vitest';
import { clusterByGroup } from './clusterByGroup';
import { groupByCountry } from '@/lib/plan/groupByCountry';
import { place as makePlace } from '@/lib/fixtures/place';
import type { Place } from '@/lib/types';

const place = (id: string, countryCode: string, lat: number, lon: number): Place =>
  makePlace({ id, name: id, lat, lon, addedAt: '2026-01-01T00:00:00.000Z', countryCode });

describe('clusterByGroup', () => {
  const smallGroup = [place('a', 'AT', 0, 0), place('b', 'AT', 0, 1)]; // 2 stops
  const bigGroup = [place('c', 'IT', 10, 10), place('d', 'IT', 10, 11), place('e', 'IT', 10, 12), place('f', 'IT', 10, 13)]; // 4 stops
  const groups = groupByCountry([...smallGroup, ...bigGroup], null);

  it('never clusters at close zoom, regardless of group size', () => {
    const items = clusterByGroup(groups, 'close');
    expect(items.every((i) => i.kind === 'pin')).toBe(true);
    expect(items).toHaveLength(6);
  });

  it('clusters only groups at/above the minimum count when zoomed out', () => {
    const items = clusterByGroup(groups, 'continental');
    const pins = items.filter((i) => i.kind === 'pin');
    const clusters = items.filter((i) => i.kind === 'cluster');
    expect(pins).toHaveLength(2); // the small AT group stays individual pins
    expect(clusters).toHaveLength(1); // the 4-stop IT group collapses
    expect(clusters[0]).toMatchObject({ countryLabel: 'Italy', count: 4 });
  });

  it('places the cluster badge at the centroid of its stops', () => {
    const [cluster] = clusterByGroup(groups, 'continental').filter((i) => i.kind === 'cluster');
    expect(cluster).toMatchObject({ lat: 10, lon: 11.5 });
  });

  it('skips a group with no resolved coordinates', () => {
    const unresolved = [
      makePlace({ id: 'x', name: 'x', lat: null, lon: null, addedAt: '2026-01-01T00:00:00.000Z' }),
    ];
    expect(clusterByGroup(groupByCountry(unresolved, null), 'continental')).toEqual([]);
  });
});
