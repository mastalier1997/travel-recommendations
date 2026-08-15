'use client';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'wanderlist:theme';
const listeners = new Set<() => void>();

export function getThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // Safari private mode etc. — falls back to 'system', just doesn't persist.
  }
  return 'system';
}

function resolve(pref: ThemePreference): ResolvedTheme {
  if (pref !== 'system') return pref;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Sets data-theme + color-scheme on <html>. Also the FOUC-prevention script's job (inline, pre-hydration) — keep the two in sync if either changes. */
export function applyTheme(pref: ThemePreference): void {
  const resolved = resolve(pref);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function setThemePreference(pref: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Theme just won't persist across reloads.
  }
  applyTheme(pref);
  listeners.forEach((l) => l());
}

/**
 * Once JS has set data-theme once, the plain `@media (prefers-color-scheme)` CSS
 * fallback (scoped to :root:not([data-theme])) never applies again — so 'system'
 * mode needs to actively re-apply on an OS theme change instead of getting it for
 * free from CSS. `storage` covers cross-tab sync (another tab changed the preference).
 */
export function subscribeTheme(onChange: () => void): () => void {
  listeners.add(onChange);
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystemChange = () => {
    if (getThemePreference() === 'system') applyTheme('system');
    onChange();
  };
  mql.addEventListener('change', onSystemChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    mql.removeEventListener('change', onSystemChange);
    window.removeEventListener('storage', onChange);
  };
}
