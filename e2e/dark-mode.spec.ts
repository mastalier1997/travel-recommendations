import { test, expect } from '@playwright/test';

// app/globals.css (Graphite): --background is #ffffff in light, #0c0f12 under prefers-color-scheme: dark.
const LIGHT_BG = 'rgb(255, 255, 255)';
const DARK_BG = 'rgb(12, 15, 18)';

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
    // Regression guard: white on the dark-mode primary (#9084da) is ~3:1 and fails AA —
    // the label must use --primary-foreground, which is the near-black background.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/dev/fixture/sample');
    const optimizeBtn = page.getByRole('button', { name: /optimize route|re-optimize|^route$/i }).first();
    await expect(optimizeBtn).toHaveCSS('color', DARK_BG); // --primary-foreground dark = --background
  });

  // Non-text contrast (1.4.11) on a direct-leg row's dashed edge — axe can't check
  // this (it's a decorative-looking border, not text), so it's an explicit
  // computed-value assertion, same idea as the button check above. kl-bali's
  // fixture route always carries a country-crossing direct leg.
  test('a direct-line row edge resolves to --direct-line, not the amber "unresolved" token, in each scheme', async ({ page }) => {
    // The theme store stamps an explicit data-theme on first load (see
    // themeStore.ts) — once set, the prefers-color-scheme fallback no longer
    // applies, so switching schemes mid-session needs a fresh load, same as the
    // "switches to dark by default" case above.
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/dev/fixture/kl-bali');
    await expect(page.locator('[data-leg-mode="direct"]').first()).toHaveCSS(
      'border-left-color',
      'rgb(18, 23, 27)', // --direct-line light = --foreground #12171b
    );

    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/dev/fixture/kl-bali');
    await expect(page.locator('[data-leg-mode="direct"]').first()).toHaveCSS(
      'border-left-color',
      'rgb(231, 236, 238)', // --direct-line dark = --foreground #e7ecee
    );
  });
});
