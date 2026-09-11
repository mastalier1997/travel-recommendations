import { describe, it, expect } from 'vitest';
import { clusterByGroup } from './clusterByGroup';
import { groupByCountry } from '@/lib/plan/groupByCountry';
import { place as makePlace } from '@/lib/fixtures/place';
import type { Place } from '@/lib/types';

const place = (id: string, countryCode: string | null, lat: number, lon: number): Place =>
  makePlace({ id, name: id, lat, lon, addedAt: '2026-01-01T00:00:00.000Z', countryCode });

// Real coordinates from the reported bug: a Kuala Lumpur -> Bali trip, all one
// itinerary-order run of Indonesia stops spanning ~1000km — the case the old
// count/zoom-band rule collapsed into one badge in the Java Sea.
const kualaLumpur = place('kl', 'MY', 3.14, 101.69);
const singapore = place('sg', 'SG', 1.35, 103.82);
const jakarta = place('jkt', 'ID', -6.21, 106.85);
const yogyakarta = place('yog', 'ID', -7.8, 110.37);
const bali = place('bali', 'ID', -8.65, 115.22);

describe('clusterByGroup', () => {
  it('keeps a huge country as multiple markers when zoomed out, not one collapsed badge', () => {
    const groups = groupByCountry([jakarta, yogyakarta, bali], null);
    const items = clusterByGroup(groups, 6); // regional zoom — well under the old 'close' cutoff of 9,
    // where the old count/band rule collapsed this whole group into one badge
    expect(items.length).toBeGreaterThan(1);
    // Every stop is still represented by some marker (pin or inside a cluster).
    const coveredIds = items.flatMap((i) => (i.kind === 'pin' ? [i.placeId] : i.memberIds));
    expect(coveredIds.sort()).toEqual(['bali', 'jkt', 'yog'].sort());
  });

  it('never merges stops across a country-group boundary, even at whole-world zoom', () => {
    const groups = groupByCountry([kualaLumpur, singapore, jakarta], null);
    const items = clusterByGroup(groups, 0);
    // 3 different countries -> 3 groups of 1 place each -> 3 pins, never merged.
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.kind === 'pin')).toBe(true);
  });

  it('merges two stops once they are within the on-screen cluster radius', () => {
    const near = place('near', 'MY', 3.1, 101.7); // ~5km from Kuala Lumpur
    const groups = groupByCountry([kualaLumpur, near], null);
    const items = clusterByGroup(groups, 10); // city-scale zoom
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'cluster', count: 2, memberIds: ['kl', 'near'] });
  });

  it('keeps the same two stops separate once zoomed in past the cluster radius', () => {
    const near = place('near', 'MY', 3.1, 101.7);
    const groups = groupByCountry([kualaLumpur, near], null);
    const items = clusterByGroup(groups, 16); // street-scale zoom
    expect(items.every((i) => i.kind === 'pin')).toBe(true);
  });

  it('labels a cluster with the itinerary ordinal range and the known country', () => {
    const near = place('near', 'MY', 3.1, 101.7);
    const [cluster] = clusterByGroup(groupByCountry([kualaLumpur, near], null), 10).filter(
      (i) => i.kind === 'cluster',
    );
    expect(cluster).toMatchObject({ label: 'Stops 1–2 · Malaysia' });
  });

  it('never labels a cluster "Unknown" or a bare number, even with no resolved country', () => {
    const nearA = place('a', null, 3.14, 101.69);
    const nearB = place('b', null, 3.1, 101.7);
    const [cluster] = clusterByGroup(groupByCountry([nearA, nearB], null), 10).filter(
      (i) => i.kind === 'cluster',
    );
    expect(cluster!.label).not.toMatch(/unknown/i);
    expect(cluster!.label).not.toMatch(/^\d+$/);
    expect(cluster!.label).toBe('Stops 1–2');
  });

  it('falls back to a plain count when an unresolved stop breaks ordinal contiguity inside a run', () => {
    const unresolvedGap = makePlace({
      id: 'gap',
      name: 'gap',
      lat: null,
      lon: null,
      addedAt: '2026-01-01T00:00:00.000Z',
      countryCode: 'MY',
    });
    const near = place('near', 'MY', 3.1, 101.7);
    const [cluster] = clusterByGroup(groupByCountry([kualaLumpur, unresolvedGap, near], null), 10).filter(
      (i) => i.kind === 'cluster',
    );
    // Ordinals 1 and 3 (the unresolved gap at 2 has no coordinates to cluster), but
    // only 2 stops are actually in the badge — "Stops 1–3" would wrongly imply 3.
    expect(cluster).toMatchObject({ label: '2 stops · Malaysia', count: 2, memberIds: ['kl', 'near'] });
  });

  it('never absorbs the selected stop into a run', () => {
    const near = place('near', 'MY', 3.1, 101.7);
    const items = clusterByGroup(groupByCountry([kualaLumpur, near], null), 10, 'kl');
    const pins = items.filter((i) => i.kind === 'pin');
    expect(pins).toContainEqual({ kind: 'pin', placeId: 'kl', lat: 3.14, lon: 101.69 });
  });

  it('skips a group with no resolved coordinates', () => {
    const unresolved = [
      makePlace({ id: 'x', name: 'x', lat: null, lon: null, addedAt: '2026-01-01T00:00:00.000Z' }),
    ];
    expect(clusterByGroup(groupByCountry(unresolved, null), 4)).toEqual([]);
  });

  it('never clusters at street-level zoom, regardless of country/group size', () => {
    const groups = groupByCountry([jakarta, yogyakarta, bali], null);
    const items = clusterByGroup(groups, 16);
    expect(items.every((i) => i.kind === 'pin')).toBe(true);
    expect(items).toHaveLength(3);
  });
});
