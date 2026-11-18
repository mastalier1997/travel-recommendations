'use client';

import { useId, useRef } from 'react';
import { useAccentPreference, useThemePreference, useResolvedTheme } from '@/lib/hooks/useTheme';
import { usePopoverPosition } from '@/lib/hooks/usePopoverPosition';
import { ACCENT_PRESETS, contrastRatio } from '@/lib/theme/accent';
import styles from './planner.module.css';

const OPTIONS: { value: 'light' | 'dark' | 'system'; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

/** Matches .themeMenu in planner.module.css — room for a row of six swatches. */
const MENU_WIDTH = 248;

/** Black or white, whichever reads on a raw swatch fill (the gym app's accentOn). */
const checkColour = (hex: string) =>
  contrastRatio('#000000', hex) >= contrastRatio('#ffffff', hex) ? '#000000' : '#ffffff';

/**
 * Native radios, not a single button that cycles three states — "pressed" can't
 * express a tri-state, and cycling makes the trigger's own name a moving target.
 * Built on the same popover pattern as ExportMenu/CardActions.
 *
 * The accent colours are the gym app's presets (lib/theme/accent.ts). Swatches
 * show the raw preset hex — a picker's swatch is its own essential presentation —
 * while the colour the app actually renders is adjusted per mode for contrast.
 */
export function ThemeToggle() {
  const [pref, setPref] = useThemePreference();
  const [accent, setAccent] = useAccentPreference();
  const resolved = useResolvedTheme();
  const id = useId().replace(/:/g, '');
  const menuId = `theme-${id}`;
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  usePopoverPosition(triggerRef, ref, { width: MENU_WIDTH });

  const stateLabel = pref === 'system' ? `System (${resolved})` : pref === 'dark' ? 'Dark' : 'Light';
  const accentLabel = ACCENT_PRESETS.find((p) => p.id === accent)?.label ?? '';

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={styles.iconButton}
        popoverTarget={menuId}
        aria-label={`Theme: ${stateLabel}`}
      >
        {/* Reflects what's actually rendering right now, not just the stored preference. */}
        {resolved === 'dark' ? (
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M13.5 9.3A5.8 5.8 0 0 1 6.7 2.5a5.8 5.8 0 1 0 6.8 6.8Z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.3" />
            <path
              d="M8 1.3v1.8M8 12.9v1.8M14.7 8h-1.8M3.1 8H1.3M12.7 3.3l-1.3 1.3M4.6 11.1l-1.3 1.3M12.7 12.7l-1.3-1.3M4.6 4.9 3.3 3.6"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

      <div id={menuId} popover="auto" ref={ref} className={`${styles.menu} ${styles.themeMenu}`}>
        <fieldset className={styles.themeFieldset}>
          <legend className={styles.menuHint}>Theme</legend>
          {OPTIONS.map((opt) => (
            <label key={opt.value} className={styles.themeOption}>
              <input
                type="radio"
                name="theme"
                value={opt.value}
                checked={pref === opt.value}
                onChange={() => setPref(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </fieldset>

        <hr className={styles.menuRule} />

        <fieldset className={styles.accentFieldset}>
          <legend className={styles.menuHint}>Colour</legend>
          <div className={styles.swatches}>
            {ACCENT_PRESETS.map((p) => {
              const checked = accent === p.id;
              return (
                <label key={p.id} className={styles.swatch} title={p.label}>
                  <input
                    type="radio"
                    name="accent"
                    value={p.id}
                    checked={checked}
                    onChange={() => setAccent(p.id)}
                    aria-label={p.label}
                    className={styles.swatchInput}
                  />
                  <span className={styles.swatchDot} style={{ background: p.hex }} aria-hidden="true">
                    {checked && (
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" style={{ color: checkColour(p.hex) }}>
                        <path
                          d="M3.5 8.5l3 3 6-7"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
          {/* The picked colour by name, so the choice never rests on colour alone. */}
          <p className={styles.swatchName} aria-hidden="true">
            {accentLabel}
          </p>
        </fieldset>
      </div>
    </>
  );
}
