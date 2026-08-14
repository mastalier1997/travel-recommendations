import { createAdminClient } from '@/lib/supabase/admin';
import type { Candidate } from '@/lib/types';
import { cacheKey, isExpired } from './cache-key';
import type { GeoProvider } from './provider';

export { cacheKey, isExpired } from './cache-key';

/** Returns null on a miss OR an expired row — both mean "the caller should fetch". */
export async function readCache(
  provider: GeoProvider,
  query: string,
  near?: { lat: number; lon: number },
): Promise<Candidate[] | null> {
  const { data } = await createAdminClient()
    .from('geo_cache')
    .select('candidates, fetched_at')
    .eq('key', cacheKey(provider, query, near))
    .maybeSingle();
  if (!data) return null;

  const candidates = data.candidates as Candidate[];
  if (isExpired(data.fetched_at as string, candidates.length)) return null;
  return candidates;
}

export async function writeCache(
  provider: GeoProvider,
  query: string,
  candidates: Candidate[],
  near?: { lat: number; lon: number },
): Promise<void> {
  await createAdminClient()
    .from('geo_cache')
    .upsert({
      key: cacheKey(provider, query, near),
      candidates,
      fetched_at: new Date().toISOString(),
    });
  // No delete-on-expiry job: an expired row is simply overwritten on next write,
  // and readCache already treats it as a miss in the meantime.
}
