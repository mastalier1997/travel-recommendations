import { createAdminClient } from '@/lib/supabase/admin';
import type { NearbyPoi } from '@/lib/types';
import { poiCacheKey, isPoiCacheExpired } from './poi-cache-key';
import type { Point } from './simplify';

export { poiCacheKey } from './poi-cache-key';

export async function readPoiCache(corridor: Point[], radiusM: number): Promise<NearbyPoi[] | null> {
  const { data } = await createAdminClient()
    .from('poi_cache')
    .select('pois, fetched_at')
    .eq('key', poiCacheKey(corridor, radiusM))
    .maybeSingle();
  if (!data) return null;
  const pois = data.pois as NearbyPoi[];
  if (isPoiCacheExpired(data.fetched_at as string, pois.length)) return null;
  return pois;
}

export async function writePoiCache(corridor: Point[], radiusM: number, pois: NearbyPoi[]): Promise<void> {
  await createAdminClient()
    .from('poi_cache')
    .upsert({ key: poiCacheKey(corridor, radiusM), pois, fetched_at: new Date().toISOString() });
}
