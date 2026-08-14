import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './config';

/**
 * Service-role client. The only thing that can reach geo_cache, place_content and
 * rate_gate — those tables have RLS on with zero policies, so anon and authenticated
 * see nothing. Tracks D and E use this; it must never be imported by a client component.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
