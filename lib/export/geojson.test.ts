import { describe, it, expect } from 'vitest';
import { toGeoJson } from './geojson';
import { SAMPLE_PLAN } from '@/lib/fixtures/sample-plan';
import type { Plan } from '@/lib/types';

const unresolvedPlace: Plan['places'][number] = {
  id: 'pl_unresolved',
  raw: 'that ramen place near the station',
  status: 'unresolved',
  name: 'that ramen place near the station',
  lat: null,
  lon: null,
  address: null,
  osm: null,
  wikidata: null,
  wikipedia: null,
  description: null,
  notes: null,
  origin: 'line',
  addedAt: '2026-08-01T09:00:00.000Z',
};

describe('toGeoJson', () => {
  it('parses as valid JSON with one Point feature per confirmed place plus the route', () => {
    const parsed = JSON.parse(toGeoJson(SAMPLE_PLAN));
    expect(parsed.type).toBe('FeatureCollection');
    const points = parsed.features.filter((f: { geometry: { type: string } }) => f.geometry.type === 'Point');
    expect(points).toHaveLength(SAMPLE_PLAN.places.length);
    expect(points.map((f: { properties: { name: string } }) => f.properties.name)).toEqual(
      SAMPLE_PLAN.places.map((p) => p.name),
    );
  });

  it('embeds the route geometry directly, unmodified', () => {
    const parsed = JSON.parse(toGeoJson(SAMPLE_PLAN));
    const routeFeature = parsed.features.find((f: { properties: { name: string } }) => f.properties.name === 'Route');
    expect(routeFeature.geometry).toEqual(SAMPLE_PLAN.route!.geometry);
  });

  it('omits the route feature when the plan has no route', () => {
    const parsed = JSON.parse(toGeoJson({ ...SAMPLE_PLAN, route: null }));
    expect(parsed.features.some((f: { properties: { name: string } }) => f.properties.name === 'Route')).toBe(false);
  });

  it('skips unresolved places without crashing', () => {
    const plan = { ...SAMPLE_PLAN, places: [...SAMPLE_PLAN.places, unresolvedPlace] };
    const parsed = JSON.parse(toGeoJson(plan));
    const points = parsed.features.filter((f: { geometry: { type: string } }) => f.geometry.type === 'Point');
    expect(points).toHaveLength(SAMPLE_PLAN.places.length);
  });
});
