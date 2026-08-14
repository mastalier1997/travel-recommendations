import { describe, it, expect } from 'vitest';
import { toKml } from './kml';
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

describe('toKml', () => {
  it('includes every confirmed place by name', () => {
    const xml = toKml(SAMPLE_PLAN);
    for (const p of SAMPLE_PLAN.places) {
      expect(xml).toContain(`<name>${p.name}</name>`);
    }
  });

  it('includes a Route placemark when the plan has a route', () => {
    expect(toKml(SAMPLE_PLAN)).toContain('<name>Route</name>');
  });

  it('omits the Route placemark when the plan has no route', () => {
    const xml = toKml({ ...SAMPLE_PLAN, route: null });
    expect(xml).not.toContain('<name>Route</name>');
  });

  it('skips unresolved places without crashing', () => {
    const plan = { ...SAMPLE_PLAN, places: [...SAMPLE_PLAN.places, unresolvedPlace] };
    const xml = toKml(plan);
    expect(xml).not.toContain(unresolvedPlace.name);
  });

  it('escapes a description containing an apostrophe', () => {
    expect(toKml(SAMPLE_PLAN)).toContain('Tenryū-ji&apos;s garden');
  });

  it('produces well-formed XML with a matching Document tag pair', () => {
    const xml = toKml(SAMPLE_PLAN);
    expect(xml.match(/<Document>/g)?.length).toBe(1);
    expect(xml.match(/<\/Document>/g)?.length).toBe(1);
    expect(xml.match(/<Placemark>/g)?.length).toBe(xml.match(/<\/Placemark>/g)?.length);
  });
});
