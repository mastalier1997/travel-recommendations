/**
 * Accent colour presets — the gym app's 11 (mastalier1997/gym,
 * src/features/settings/AccentColorPicker.tsx; also Graphite's `accentPresets`),
 * with its per-mode contrast adjustment ported from src/theme/theme.ts.
 *
 * A preset is stored as its raw hex. The colour actually rendered in each mode
 * is derived from it by walking HSL lightness (hue and saturation kept) until
 * text in that colour reaches 4.5:1 — the gym app's clampAccentForContrast.
 *
 * One deliberate difference from the gym app: it checks against the page
 * background only. Here accent text also sits on the sidebar/sheet (--card) and
 * on cards and menus (--popover), so each mode is checked against the hardest of
 * those surfaces instead. Without that, several presets would fail AA on the
 * sidebar. The gym app's relaxed 3:1 exception for Yellow is likewise not
 * carried over: every preset here passes 4.5:1 as text in both modes.
 *
 * Violet, the default, uses Graphite's own published values rather than the
 * computed ones — they're the design system's reference and already pass.
 *
 * Pure and dependency-free: imported by the root layout (server) to inline the
 * table into the no-flash script, and by client components.
 */

export type AccentId =
  | 'violet'
  | 'indigo'
  | 'sky'
  | 'cyan'
  | 'teal'
  | 'sage'
  | 'yellow'
  | 'olive'
  | 'orange'
  | 'red'
  | 'pink';

export type AccentPreset = {
  id: AccentId;
  /** The gym app's English label. Its "orange" preset is labelled "Amber" there. */
  label: string;
  /** The raw pick — shown as-is on the swatch (a colour picker's swatch is its own
   * "essential presentation"), never used directly as text. */
  hex: string;
};

export const ACCENT_PRESETS: readonly AccentPreset[] = [
  { id: 'violet', label: 'Violet', hex: '#9084da' },
  { id: 'indigo', label: 'Indigo', hex: '#5596dc' },
  { id: 'sky', label: 'Sky', hex: '#00a3c7' },
  { id: 'cyan', label: 'Cyan', hex: '#00aaa3' },
  { id: 'teal', label: 'Teal', hex: '#41a974' },
  { id: 'sage', label: 'Sage', hex: '#7ca047' },
  { id: 'yellow', label: 'Yellow', hex: '#eacc56' },
  { id: 'olive', label: 'Olive', hex: '#c2832d' },
  { id: 'orange', label: 'Amber', hex: '#d27558' },
  { id: 'red', label: 'Red', hex: '#e67a73' },
  { id: 'pink', label: 'Pink', hex: '#da7bb3' },
];

export const DEFAULT_ACCENT: AccentId = 'violet';

export function isAccentId(value: unknown): value is AccentId {
  return typeof value === 'string' && ACCENT_PRESETS.some((p) => p.id === value);
}

export type Mode = 'light' | 'dark';

/**
 * Surfaces accent-coloured text is drawn on, per mode (app/globals.css):
 * --background, --card (sidebar, bottom sheet), --popover (cards, menus).
 * The adjustment targets the hardest one; the rest then pass with room to spare.
 */
export const ACCENT_TEXT_SURFACES: Record<Mode, readonly string[]> = {
  light: ['#ffffff', '#eef1f2'],
  dark: ['#0c0f12', '#141a1f', '#1c242b'],
};

/** Text drawn on an accent fill (Graphite --primary-foreground). The adjustment
 * guarantees >= 4.5:1 for these on every resolved accent (see accent.test.ts). */
export const ACCENT_FOREGROUND: Record<Mode, string> = {
  light: '#ffffff',
  dark: '#0c0f12',
};

/** Graphite's own --primary for the default violet. */
const GRAPHITE_VIOLET: Record<Mode, string> = { light: '#6656c8', dark: '#9084da' };

const MIN_TEXT_CONTRAST = 4.5;

// --- colour math, ported from the gym app's src/theme/theme.ts ---------------

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rN = r / 255;
  const gN = g / 255;
  const bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rN) h = ((gN - bN) / d) % 6;
  else if (max === gN) h = (bN - rN) / d + 2;
  else h = (rN - gN) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return { r: (rgb[0] + m) * 255, g: (rgb[1] + m) * 255, b: (rgb[2] + m) * 255 };
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const ch = (v: number) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** WCAG contrast ratio, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(hexToRgb(a));
  const lb = relativeLuminance(hexToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The gym app's clampAccentForContrast: lightness only, 1% steps, toward
 * whichever extreme increases contrast against `ref`. Always terminates. */
export function clampForContrast(hex: string, ref: string, min = MIN_TEXT_CONTRAST): string {
  if (contrastRatio(hex, ref) >= min) return hex;
  const hsl = rgbToHsl(hexToRgb(hex));
  const darken = relativeLuminance(hexToRgb(ref)) > relativeLuminance(hexToRgb(hex));
  let l = hsl.l;
  for (let i = 0; i < 100; i++) {
    l = Math.min(100, Math.max(0, l + (darken ? -1 : 1)));
    const candidate = rgbToHex(hslToRgb({ ...hsl, l }));
    if (contrastRatio(candidate, ref) >= min) return candidate;
    if (l === 0 || l === 100) break;
  }
  return rgbToHex(hslToRgb({ ...hsl, l }));
}

/** The hardest surface for accent text in a mode: lowest contrast with the pick. */
function hardestSurface(hex: string, mode: Mode): string {
  return ACCENT_TEXT_SURFACES[mode].reduce((worst, s) =>
    contrastRatio(hex, s) < contrastRatio(hex, worst) ? s : worst,
  );
}

/** The colour rendered for a preset in a mode — text-safe on every accent surface. */
export function resolveAccent(id: AccentId, mode: Mode): string {
  if (id === 'violet') return GRAPHITE_VIOLET[mode];
  const preset = ACCENT_PRESETS.find((p) => p.id === id) ?? ACCENT_PRESETS[0];
  let hex = preset.hex;
  // Re-check after each step: clearing one surface can't un-clear another in the
  // same direction, so this settles in at most one pass per surface.
  for (let i = 0; i < ACCENT_TEXT_SURFACES[mode].length; i++) {
    hex = clampForContrast(hex, hardestSurface(hex, mode));
  }
  return hex;
}

/** Both modes for every preset — inlined into the root layout's no-flash script. */
export function resolvedAccentTable(): Record<AccentId, { light: string; dark: string }> {
  return Object.fromEntries(
    ACCENT_PRESETS.map((p) => [p.id, { light: resolveAccent(p.id, 'light'), dark: resolveAccent(p.id, 'dark') }]),
  ) as Record<AccentId, { light: string; dark: string }>;
}
