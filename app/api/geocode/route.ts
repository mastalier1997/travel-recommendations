import { MOCK, notImplemented } from '@/lib/mock';
import type { Candidate, GeocodeRequest, GeocodeResponse } from '@/lib/types';
import recorded from '@/lib/fixtures/geocode-responses.json';
import { normalizeQuery } from '@/lib/geo/normalize';

const RESPONSES = recorded as unknown as Record<string, { candidates: Candidate[] }>;

export async function POST(req: Request) {
  const { q } = (await req.json()) as GeocodeRequest;
  if (!q?.trim()) return Response.json({ error: 'q is required' }, { status: 400 });

  if (MOCK) {
    const candidates = RESPONSES[normalizeQuery(q)]?.candidates ?? [];
    // Real geocoding is the slow step; a flat 0ms mock hides every loading state.
    await new Promise((r) => setTimeout(r, 220));
    return Response.json({ candidates } satisfies GeocodeResponse);
  }

  // Track D: Nominatim/MapTiler + geo_cache + rate_gate. Normalize to Candidate[] here
  // so nothing downstream ever learns which provider answered.
  return notImplemented('D');
}
