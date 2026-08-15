'use client';

import { useSyncExternalStore } from 'react';
import {
  getThemePreference,
  setThemePreference,
  subscribeTheme,
  type ThemePreference,
} from '@/lib/theme/themeStore';
import { usePrefersDark } from './useMediaQuery';

const SERVER_SNAPSHOT: ThemePreference = 'system';

/** The user's stored choice — 'light' | 'dark' | 'system'. Setter persists + applies immediately. */
export function useThemePreference(): [ThemePreference, (pref: ThemePreference) => void] {
  const pref = useSyncExternalStore(subscribeTheme, getThemePreference, () => SERVER_SNAPSHOT);
  return [pref, setThemePreference];
}

/** What's actually rendered right now — 'system' resolved against the live OS preference. */
export function useResolvedTheme(): 'light' | 'dark' {
  const [pref] = useThemePreference();
  const prefersDark = usePrefersDark();
  return pref === 'system' ? (prefersDark ? 'dark' : 'light') : pref;
}
