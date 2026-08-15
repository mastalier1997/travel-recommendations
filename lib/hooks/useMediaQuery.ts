'use client';

import { useSyncExternalStore } from 'react';

/**
 * SSR-safe media query. useSyncExternalStore rather than useEffect+useState so the
 * first client render already has the right answer and the sheet does not flash open.
 * Server snapshot is `false` — desktop markup is the SSR default.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Below this the layout is a full-bleed map with a bottom sheet, not two panes. */
export const useIsMobile = () => useMediaQuery('(max-width: 767px)');

export const usePrefersReducedMotion = () =>
  useMediaQuery('(prefers-reduced-motion: reduce)');

export const usePrefersDark = () => useMediaQuery('(prefers-color-scheme: dark)');
