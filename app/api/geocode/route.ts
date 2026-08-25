import { MOCK } from '@/lib/mock';
import type { ApiError, Candidate, GeocodeRequest, GeocodeResponse } from '@/lib/types';
import recorded from '@/lib/fixtures/geocode-responses.json';
import { normalizeQuery } from '@/lib/geo/normalize';
import { activeProvider } from '@/lib/geo/provider';
import { searchNominatim } from '@/lib/geo/nominatim';
import { searchMapTiler } from '@/lib/geo/maptiler';
import { readCache, writeCache } from '@/lib/geo/cache';
import { waitForSlot, RateLimitedError } from '@/lib/geo/gate';

const RESPONSES = recorded as unknown as Record<string, { candidates: Candidate[] }>;

export async function POST(req: Request) {
  const { q, near } = (await req.json()) as GeocodeRequest;
  if (!q?.trim()) return Response.json({ error: 'q is required' }, { status: 400 });

  if (MOCK) {
    const normalized = normalizeQuery(q);
    // e2e-only escape hatch (e2e/import-recovery.spec.ts): the recorded fixtures can
    // only express success/no-match, never a network failure, so this magic query
    // forces the same error shape the real provider fetch produces on failure.
    if (normalized === 'trigger geocode error') {
      return Response.json({ error: 'Could not reach the geocoder.' } satisfies ApiError, {
        status: 502,
      });
    }
    const candidates = RESPONSES[normalized]?.candidates ?? [];
    // Real geocoding is the slow step; a flat 0ms mock hides every loading state.
    await new Promise((r) => setTimeout(r, 220));
    return Response.json({ candidates } satisfies GeocodeResponse);
  }

  const provider = activeProvider();

  const cached = await readCache(provider, q, near);
  if (cached) return Response.json({ candidates: cached } satisfies GeocodeResponse);

  // Only Nominatim carries the 1 req/s policy — MapTiler is keyed and billed, with
  // its own much higher account-level limits, so this gate is a dev-mode concern.
  if (provider === 'nominatim') {
    try {
      await waitForSlot('nominatim');
    } catch (err) {
      if (err instanceof RateLimitedError) {
        return Response.json(
          { error: err.message, retryAfterMs: err.retryAfterMs } satisfies ApiError,
          { status: 429 },
        );
      }
      throw err;
    }
  }

  try {
    const candidates =
      provider === 'maptiler' ? await searchMapTiler(q, near) : await searchNominatim(q, near);
    // Cache even a zero-result response — see cache.ts's shorter TTL for misses.
    await writeCache(provider, q, candidates, near);
    return Response.json({ candidates } satisfies GeocodeResponse);
  } catch {
    return Response.json({ error: 'Could not reach the geocoder.' } satisfies ApiError, {
      status: 502,
    });
  }
}
