'use client';

import { useResolvedTheme, useThemePreference } from '@/lib/hooks/useTheme';
import styles from './planner.module.css';

/**
 * Graphite's ModeToggle: one outline icon button, sun in light and moon in dark.
 * It follows the device until clicked; a click stores the opposite of what is
 * showing. A two-state toggle, so `aria-pressed` expresses it exactly ("Dark
 * mode, pressed"). "Match my device" — the third state — lives on /settings.
 */
export function ThemeToggle() {
  const [, setPref] = useThemePreference();
  // What's actually rendering right now, not just the stored preference.
  const dark = useResolvedTheme() === 'dark';

  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-label="Dark mode"
      aria-pressed={dark}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setPref(dark ? 'light' : 'dark')}
    >
      {dark ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M13.5 9.3A5.8 5.8 0 0 1 6.7 2.5a5.8 5.8 0 1 0 6.8 6.8Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M8 1.3v1.8M8 12.9v1.8M14.7 8h-1.8M3.1 8H1.3M12.7 3.3l-1.3 1.3M4.6 11.1l-1.3 1.3M12.7 12.7l-1.3-1.3M4.6 4.9 3.3 3.6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
