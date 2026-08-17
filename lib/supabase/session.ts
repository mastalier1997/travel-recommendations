export const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;

/**
 * The earliest `amr` entry's timestamp is when this session's chain of auth
 * began — unlike the token's own `iat`, it survives every refresh, which is
 * what makes it usable as "session age" rather than "access token age".
 */
export function sessionAgeS(claims: { amr?: unknown }, nowS = Math.floor(Date.now() / 1000)): number | null {
  const first = Array.isArray(claims.amr) ? claims.amr[0] : null;
  const timestamp = first && typeof first === 'object' ? (first as { timestamp?: unknown }).timestamp : null;
  return typeof timestamp === 'number' ? nowS - timestamp : null;
}

// Fails open: an unreadable amr claim reads as age 0 (not expired), not expired.
// This is the only enforcement of the 30-day cutoff on the free tier (see
// middleware.ts), so if a future claims-shape change ever makes amr
// unreadable, the cutoff goes silently unenforced rather than erring toward
// signing people out.
export function isSessionExpired(claims: { amr?: unknown }, nowS?: number): boolean {
  return (sessionAgeS(claims, nowS) ?? 0) > SESSION_MAX_AGE_S;
}
