import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ACCENT_PRESETS, resolveAccent } from '../lib/theme/accent';

// The accent colour picker in the theme menu (lib/theme/accent.ts — the gym
// app's 11 presets, adjusted per mode for contrast).

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

const optimizeButton = (page: Page) => page.getByRole('button', { name: /optimize route|re-optimize|^route$/i }).first();

async function pickAccent(page: Page, label: string) {
  await page.getByRole('button', { name: /^Theme:/ }).click();
  await page.getByRole('radio', { name: label, exact: true }).check();
  await page.keyboard.press('Escape');
}

test('defaults to Graphite violet', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/dev/fixture/sample');
  await expect(optimizeButton(page)).toHaveCSS('background-color', rgb('#6656c8'));
});

test('picking a colour recolours the app and survives a reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/dev/fixture/sample');

  await page.getByRole('button', { name: /^Theme:/ }).click();
  const teal = page.getByRole('radio', { name: 'Teal', exact: true });
  await teal.check();
  await expect(teal).toBeChecked();
  // Named in text too, not shown by colour alone.
  await expect(page.locator('[popover]:popover-open').getByText('Teal', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  const tealLight = rgb(resolveAccent('teal', 'light'));
  await expect(optimizeButton(page)).toHaveCSS('background-color', tealLight);
  await expect(optimizeButton(page)).toHaveCSS('color', 'rgb(255, 255, 255)');

  await page.reload();
  await expect(optimizeButton(page)).toHaveCSS('background-color', tealLight);
  // Applied by the inline no-flash script, before React hydrates.
  const inline = await page.evaluate(() => document.documentElement.style.getPropertyValue('--accent-light'));
  expect(inline).toBe(resolveAccent('teal', 'light'));
});

test('dark mode uses the dark variant of the picked colour', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/dev/fixture/sample');
  await pickAccent(page, 'Amber');
  await expect(optimizeButton(page)).toHaveCSS('background-color', rgb(resolveAccent('orange', 'dark')));
  // --primary-foreground in dark: near-black text on the accent fill.
  await expect(optimizeButton(page)).toHaveCSS('color', 'rgb(12, 15, 18)');
});

test('switching light/dark after picking keeps the colour, in the right variant', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/dev/fixture/sample');
  await pickAccent(page, 'Pink');
  await expect(optimizeButton(page)).toHaveCSS('background-color', rgb(resolveAccent('pink', 'light')));

  await page.getByRole('button', { name: /^Theme:/ }).click();
  await page.getByRole('radio', { name: 'Dark', exact: true }).check();
  await page.keyboard.press('Escape');
  await expect(optimizeButton(page)).toHaveCSS('background-color', rgb(resolveAccent('pink', 'dark')));
});

test('a junk stored value can’t blank the accent before hydration', async ({ page }) => {
  // 'constructor' is a key every plain object inherits — the no-flash script used
  // to look it up in the colour table, find a function, and set the accent to
  // "undefined", leaving buttons and links with no colour.
  await page.addInitScript(() => localStorage.setItem('wanderlist:accent', 'constructor'));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/dev/fixture/sample');
  const inline = await page.evaluate(() => document.documentElement.style.getPropertyValue('--accent-light'));
  expect(inline).toBe('');
  await expect(optimizeButton(page)).toHaveCSS('background-color', rgb('#6656c8'));
});

// Every colour in both schemes: the adjusted colours must keep all accent text
// (links, Undo, buttons) at AA. kl-bali has the most accent-coloured text.
for (const preset of ACCENT_PRESETS) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`${preset.label} (${scheme}) has no colour-contrast violations`, async ({ page }) => {
      await page.addInitScript((id) => localStorage.setItem('wanderlist:accent', id), preset.id);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/dev/fixture/kl-bali');
      await expect(optimizeButton(page)).toHaveCSS('background-color', rgb(resolveAccent(preset.id, scheme)));
      const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });
  }
}
