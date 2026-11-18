'use client';

import Link from 'next/link';
import { useAccentPreference, useResolvedTheme, useThemePreference } from '@/lib/hooks/useTheme';
import { ACCENT_PRESETS, contrastRatio } from '@/lib/theme/accent';
import type { ThemePreference } from '@/lib/theme/themeStore';
import styles from './settings.module.css';

const THEMES: { value: ThemePreference; label: string; hint?: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Match my device', hint: 'Follows your phone or computer setting.' },
];

/** Black or white, whichever reads on a raw swatch fill (the gym app's accentOn). */
const checkColour = (hex: string) =>
  contrastRatio('#000000', hex) >= contrastRatio('#ffffff', hex) ? '#000000' : '#ffffff';

type Props = { backHref: string; backLabel: string };

/**
 * Native radios throughout: arrow keys move within each group, and the choice is
 * applied as it's made — there is nothing to save. Swatches show the raw preset
 * colour (a picker's swatch is its own essential presentation); the app renders an
 * adjusted version per mode for contrast (lib/theme/accent.ts), which the preview
 * below the swatches shows.
 */
export function SettingsScreen({ backHref, backLabel }: Props) {
  const [themePref, setThemePref] = useThemePreference();
  const [accent, setAccent] = useAccentPreference();
  const resolved = useResolvedTheme();
  const accentLabel = ACCENT_PRESETS.find((p) => p.id === accent)?.label ?? '';

  return (
    <main className={styles.wrap}>
      <Link href={backHref} className={styles.back}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {backLabel}
      </Link>

      <h1 className={styles.title}>Settings</h1>
      <p className={styles.note}>Saved on this device.</p>

      <section className={styles.section} aria-labelledby="appearance-h">
        <h2 id="appearance-h" className={styles.sectionTitle}>
          Appearance
        </h2>

        <div className={styles.card}>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Theme</legend>
            <div className={styles.options}>
              {THEMES.map((t) => (
                <label key={t.value} className={styles.option}>
                  <input
                    type="radio"
                    name="theme"
                    value={t.value}
                    checked={themePref === t.value}
                    onChange={() => setThemePref(t.value)}
                  />
                  <span className={styles.optionText}>
                    <span>{t.label}</span>
                    {t.hint && (
                      <span className={styles.optionHint}>
                        {t.hint} Now: {resolved === 'dark' ? 'dark' : 'light'}.
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className={styles.card}>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Accent colour</legend>
            <p className={styles.fieldHint}>For buttons, links, your route and the map pins.</p>
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
                        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" style={{ color: checkColour(p.hex) }}>
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

            {/* The picked colour by name, so the choice never rests on colour alone,
                and a preview in the colour as the app will actually draw it. */}
            <div className={styles.preview} aria-hidden="true">
              <span className={styles.previewLabel}>{accentLabel}</span>
              <div className={styles.previewRow}>
                <span className={styles.previewButton}>Optimize route</span>
                <span className={styles.previewRoute} />
                <span className={styles.previewLink}>Undo</span>
              </div>
            </div>
          </fieldset>
        </div>
      </section>
    </main>
  );
}
