const BLOCKED_PREFIXES = ['/login', '/auth'];

/**
 * Validates a `next` redirect target: same-origin and not back into the auth
 * flow itself (which would loop). `new URL(next, origin)` also neutralizes
 * protocol-relative targets like `//evil.com` — those resolve to a different
 * origin and get rejected below.
 */
export function safeNext(next: string | null | undefined, origin: string): string {
  if (next) {
    try {
      const url = new URL(next, origin);
      const inAuthFlow = BLOCKED_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`));
      if (url.origin === origin && !inAuthFlow) {
        return `${url.pathname}${url.search}`;
      }
    } catch {
      // malformed — fall through to the default
    }
  }
  return '/plans';
}
