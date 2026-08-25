import { createAdminClient } from '@/lib/supabase/admin';
import { decideWait, MIN_INTERVAL_MS, RateLimitedError, type RateGateProvider } from './gate-decision';

export { RateLimitedError, MIN_INTERVAL_MS, MAX_WAIT_MS, type RateGateProvider } from './gate-decision';

/**
 * Claims the next slot for `provider` and waits for it (or throws RateLimitedError
 * if the queue is too deep). Postgres is the clock — see claim_rate_slot in
 * supabase/migrations/0002_rate_gate_fn.sql for why this can't be a plain
 * read-then-write from here.
 */
export async function waitForSlot(provider: RateGateProvider): Promise<void> {
  const { data, error } = await createAdminClient().rpc('claim_rate_slot', {
    p_provider: provider,
    p_interval_ms: MIN_INTERVAL_MS[provider],
  });
  if (error) throw new Error(`rate gate failed: ${error.message}`);

  const decision = decideWait(new Date(data as string));
  if (decision.action === 'bail') throw new RateLimitedError(decision.retryAfterMs);
  if (decision.action === 'sleep') await new Promise((r) => setTimeout(r, decision.ms));
}
