'use client';

import { useSyncExternalStore } from 'react';
import {
  getAccentPreference,
  getThemePreference,
  setAccentPreference,
  setThemePreference,
  subscribeTheme,
  type ThemePreference,
} from '@/lib/theme/themeStore';
import { DEFAULT_ACCENT, type AccentId } from '@/lib/theme/accent';
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

/** The picked accent preset ('violet' etc.). Setter persists + applies immediately. */
export function useAccentPreference(): [AccentId, (id: AccentId) => void] {
  const id = useSyncExternalStore(subscribeTheme, getAccentPreference, () => DEFAULT_ACCENT);
  return [id, setAccentPreference];
}
