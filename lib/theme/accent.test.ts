import { describe, expect, it } from 'vitest';
import {
  ACCENT_FOREGROUND,
  ACCENT_PRESETS,
  ACCENT_TEXT_SURFACES,
  clampForContrast,
  contrastRatio,
  isAccentId,
  resolveAccent,
  resolvedAccentTable,
  type Mode,
} from './accent';

const MODES: Mode[] = ['light', 'dark'];

describe('accent presets', () => {
  it('are the gym app’s 11 presets, violet first', () => {
    expect(ACCENT_PRESETS.map((p) => p.hex)).toEqual([
      '#9084da',
      '#5596dc',
      '#00a3c7',
      '#00aaa3',
      '#41a974',
      '#7ca047',
      '#eacc56',
      '#c2832d',
      '#d27558',
      '#e67a73',
      '#da7bb3',
    ]);
  });

  it('violet keeps Graphite’s own values', () => {
    expect(resolveAccent('violet', 'light')).toBe('#6656c8');
    expect(resolveAccent('violet', 'dark')).toBe('#9084da');
  });

  for (const preset of ACCENT_PRESETS) {
    for (const mode of MODES) {
      it(`${preset.label} (${mode}) passes 4.5:1 as text on every accent surface`, () => {
        const resolved = resolveAccent(preset.id, mode);
        for (const surface of ACCENT_TEXT_SURFACES[mode]) {
          expect(contrastRatio(resolved, surface), `${resolved} on ${surface}`).toBeGreaterThanOrEqual(4.5);
        }
      });

      it(`${preset.label} (${mode}) carries its foreground at 4.5:1 as a button fill`, () => {
        const resolved = resolveAccent(preset.id, mode);
        expect(contrastRatio(ACCENT_FOREGROUND[mode], resolved)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('keeps the hue: the clamp only moves lightness', () => {
    // Sky is too light for white in light mode — it must come out darker, still blue-green.
    const sky = resolveAccent('sky', 'light');
    expect(sky).not.toBe('#00a3c7');
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(sky.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(r);
  });

  it('returns an already-passing colour unchanged', () => {
    expect(clampForContrast('#000000', '#ffffff')).toBe('#000000');
  });

  it('table covers every preset in both modes', () => {
    const table = resolvedAccentTable();
    expect(Object.keys(table)).toHaveLength(11);
    expect(table.violet).toEqual({ light: '#6656c8', dark: '#9084da' });
  });

  it('validates stored ids', () => {
    expect(isAccentId('teal')).toBe(true);
    expect(isAccentId('#41a974')).toBe(false);
    expect(isAccentId(null)).toBe(false);
  });
});
