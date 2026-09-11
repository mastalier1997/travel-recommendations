import { MOCK } from '@/lib/mock';
import type { ApiError, NearbyPoi, NearbyResponse } from '@/lib/types';
import fixturePois from '@/lib/fixtures/nearby-pois.json';
import { searchOverpass, validateNearbyRequest } from '@/lib/geo/overpass';
import { readPoiCache, writePoiCache } from '@/lib/geo/poi-cache';
import { waitForSlot, RateLimitedError } from '@/lib/geo/gate';

const FIXTURE_POIS = fixturePois as NearbyPoi[];

export async function POST(req: Request) {
  const body = (await req.json()) as { corridor?: unknown; radiusM?: unknown };
  const valid = validateNearbyRequest(body.corridor, body.radiusM);
  if (!valid) return Response.json({ error: 'corridor/radiusM is invalid' }, { status: 400 });
  const { corridor, radiusM } = valid;

  if (MOCK) {
    // Real Overpass is the slow step; a flat 0ms mock hides every loading state.
    await new Promise((r) => setTimeout(r, 220));
    return Response.json({ pois: FIXTURE_POIS } satisfies NearbyResponse);
  }

  const cached = await readPoiCache(corridor, radiusM);
  if (cached) return Response.json({ pois: cached } satisfies NearbyResponse);

  try {
    await waitForSlot('overpass');
  } catch (err) {
    if (err instanceof RateLimitedError) {
      return Response.json(
        { error: err.message, retryAfterMs: err.retryAfterMs } satisfies ApiError,
        { status: 429 },
      );
    }
    throw err;
  }

  let pois: NearbyPoi[];
  try {
    pois = await searchOverpass(corridor, radiusM);
  } catch (err) {
    console.error('[nearby] Overpass request failed:', err);
    return Response.json({ error: 'Could not reach the places service.' } satisfies ApiError, {
      status: 502,
    });
  }

  try {
    await writePoiCache(corridor, radiusM, pois);
  } catch (err) {
    console.error('[nearby] cache write failed:', err);
  }

  return Response.json({ pois } satisfies NearbyResponse);
}
