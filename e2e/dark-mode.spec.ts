import { test, expect } from '@playwright/test';

// app/globals.css: --bg is #fbfaf9 in light, #1a1815 under prefers-color-scheme: dark.
const LIGHT_BG = 'rgb(251, 250, 249)';
const DARK_BG = 'rgb(26, 24, 21)';

test.describe('dark mode (prefers-color-scheme)', () => {
  test('defaults to the light token set', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/dev/fixture/sample');
    await expect(page.locator('body')).toHaveCSS('background-color', LIGHT_BG);
  });

  test('switches to the dark token set by default, following the OS (no override set)', async ({ page }) => {
    // A manual toggle now exists (see theme-toggle.spec.ts) — this covers the
    // untouched 'system' default, which is still driven purely by the OS preference.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/dev/fixture/sample');
    await expect(page.locator('body')).toHaveCSS('background-color', DARK_BG);
  });

  test('the primary action button never renders white text on the accent fill', async ({ page }) => {
    // Regression guard for the failing 2.5:1 white-on-#f08a52 case the a11y review flagged.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/dev/fixture/sample');
    const optimizeBtn = page.getByRole('button', { name: /optimize route|re-optimize|^route$/i }).first();
    await expect(optimizeBtn).toHaveCSS('color', 'rgb(26, 24, 21)'); // --text-on-accent dark = --bg
  });
});
