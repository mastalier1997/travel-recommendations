export type RateGateProvider = 'nominatim' | 'overpass';

/** Margin over each provider's own rate policy, keyed by provider — Nominatim's
 * 1 req/s (1000ms exactly would be cutting it close) and Overpass's public
 * instance, which wants real breathing room between dense corridor queries. */
export const MIN_INTERVAL_MS: Record<RateGateProvider, number> = {
  nominatim: 1050,
  overpass: 5000,
};
/** Past this wait, bail rather than hold a serverless invocation open. */
export const MAX_WAIT_MS = 4000;

export class RateLimitedError extends Error {
  constructor(public retryAfterMs: number) {
    super('Geocoder is busy — try again shortly.');
  }
}

export type WaitDecision =
  | { action: 'proceed' }
  | { action: 'sleep'; ms: number }
  | { action: 'bail'; retryAfterMs: number };

/**
 * Pure: given the slot this request was assigned and the current time, decide
 * whether to go now, sleep, or give up. Split out so the ~4s boundary is checkable
 * without a database.
 */
export function decideWait(slot: Date, now: Date = new Date()): WaitDecision {
  const waitMs = slot.getTime() - now.getTime();
  if (waitMs <= 0) return { action: 'proceed' };
  if (waitMs > MAX_WAIT_MS) return { action: 'bail', retryAfterMs: waitMs };
  return { action: 'sleep', ms: waitMs };
}
