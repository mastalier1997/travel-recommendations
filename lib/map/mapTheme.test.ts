import { describe, expect, it } from 'vitest';
import { MAP_COLORS } from './mapTheme';
import { ACCENT_PRESETS, resolveAccent } from '@/lib/theme/accent';

/** RGB chroma (max − min channel), 0–1: how coloured a colour looks. Unlike HSL
 * saturation it doesn't blow up near black or white, where Graphite's neutrals
 * (slightly blue-tinted, e.g. #12171b) would otherwise read as "20% saturated". */
function chroma(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return Math.max(r, g, b) - Math.min(r, g, b);
}

describe('direct-leg line vs the accent route line', () => {
  // The route line is drawn in the picked accent (MapView), the direct leg in
  // MAP_COLORS.direct. A direct leg has no road route — it must never be drawn
  // in a colour an accent can take (it used to equal dark-mode Indigo exactly).
  for (const mode of ['light', 'dark'] as const) {
    it(`is achromatic in ${mode}, while every accent is clearly coloured`, () => {
      expect(chroma(MAP_COLORS[mode].direct)).toBeLessThan(0.06);
      for (const p of ACCENT_PRESETS) {
        expect(chroma(resolveAccent(p.id, mode)), p.label).toBeGreaterThan(0.2);
      }
    });
  }
});
