import { describe, it, expect } from 'vitest';
import { toGpx } from './gpx';
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

describe('toGpx', () => {
  it('includes a wpt for every confirmed place', () => {
    const gpx = toGpx(SAMPLE_PLAN);
    expect(gpx.match(/<wpt /g)?.length).toBe(SAMPLE_PLAN.places.length);
    for (const p of SAMPLE_PLAN.places) {
      expect(gpx).toContain(`<name>${p.name}</name>`);
    }
  });

  it('includes a trk with one trkpt per route geometry coordinate', () => {
    const gpx = toGpx(SAMPLE_PLAN);
    expect(gpx).toContain('<trk>');
    expect(gpx.match(/<trkpt /g)?.length).toBe(SAMPLE_PLAN.route!.geometry.coordinates.length);
  });

  it('omits the trk when the plan has no route', () => {
    const gpx = toGpx({ ...SAMPLE_PLAN, route: null });
    expect(gpx).not.toContain('<trk>');
  });

  it('skips unresolved places without crashing', () => {
    const plan = { ...SAMPLE_PLAN, places: [...SAMPLE_PLAN.places, unresolvedPlace] };
    const gpx = toGpx(plan);
    expect(gpx.match(/<wpt /g)?.length).toBe(SAMPLE_PLAN.places.length);
  });

  it('escapes a description containing an apostrophe', () => {
    expect(toGpx(SAMPLE_PLAN)).toContain('Tenryū-ji&apos;s garden');
  });
});
