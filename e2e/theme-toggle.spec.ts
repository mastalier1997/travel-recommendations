import { test, expect } from '@playwright/test';

// app/globals.css (Graphite): --background is #ffffff in light, #0c0f12 in dark.
const LIGHT_BG = 'rgb(255, 255, 255)';
const DARK_BG = 'rgb(12, 15, 18)';

// The header's theme control is Graphite's ModeToggle: one button that flips
// light/dark. "Match my device" (the third state) lives on /settings.
test.describe('theme toggle', () => {
  test('one click flips the theme, and the choice survives a reload with no flash', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/dev/fixture/sample');
    await expect(page.locator('body')).toHaveCSS('background-color', DARK_BG);

    const toggle = page.getByRole('button', { name: 'Dark mode' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect(page.locator('body')).toHaveCSS('background-color', LIGHT_BG);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    // The OS is still emulated as dark — if this comes back light, the FOUC script
    // in app/layout.tsx correctly read the persisted choice before first paint.
    await page.reload();
    await expect(page.locator('body')).toHaveCSS('background-color', LIGHT_BG);

    await page.getByRole('button', { name: 'Dark mode' }).click();
    await expect(page.locator('body')).toHaveCSS('background-color', DARK_BG);
  });

  test('it starts out following the device', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/dev/fixture/sample');
    await expect(page.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('body')).toHaveCSS('background-color', LIGHT_BG);
  });

  test('"Match my device" on Settings hands the theme back to the device', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/dev/fixture/sample');
    const toggle = page.getByRole('button', { name: 'Dark mode' });
    // Hydrated (the server render can't know the device is dark) before clicking.
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect(page.locator('body')).toHaveCSS('background-color', LIGHT_BG);

    await page.goto('/settings');
    await expect(page.getByRole('radio', { name: 'Light', exact: true })).toBeChecked();
    await page.getByRole('radio', { name: /Match my device/ }).check();
    await expect(page.locator('body')).toHaveCSS('background-color', DARK_BG);
  });

  test('a settings theme choice keeps its radio checked under forced-colors', async ({ page }) => {
    await page.goto('/settings');
    await page.emulateMedia({ forcedColors: 'active' });
    const darkRadio = page.getByRole('radio', { name: 'Dark', exact: true });
    await darkRadio.check();
    await expect(darkRadio).toBeChecked();
  });
});
