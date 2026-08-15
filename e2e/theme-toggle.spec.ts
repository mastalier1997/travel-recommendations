import { test, expect } from '@playwright/test';

// app/globals.css: --bg is #fbfaf9 in light, #1a1815 in dark.
const LIGHT_BG = 'rgb(251, 250, 249)';
const DARK_BG = 'rgb(26, 24, 21)';

test.describe('manual theme toggle', () => {
  test('overrides the OS preference and survives a reload with no flash', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/dev/fixture/sample');
    await expect(page.locator('body')).toHaveCSS('background-color', DARK_BG);

    await page.getByRole('button', { name: /^Theme:/i }).click();
    await page.getByRole('radio', { name: 'Light' }).check();
    await expect(page.locator('body')).toHaveCSS('background-color', LIGHT_BG);

    // The OS is still emulated as dark — if this comes back light, the FOUC script
    // in app/layout.tsx correctly read the persisted override before first paint.
    await page.reload();
    await expect(page.locator('body')).toHaveCSS('background-color', LIGHT_BG);
  });

  test('"System" mode reverts to following the OS preference', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/dev/fixture/sample');

    await page.getByRole('button', { name: /^Theme:/i }).click();
    await page.getByRole('radio', { name: 'Light' }).check();
    await expect(page.locator('body')).toHaveCSS('background-color', LIGHT_BG);

    await page.getByRole('radio', { name: 'System' }).check();
    await expect(page.locator('body')).toHaveCSS('background-color', DARK_BG);
  });

  test('selecting a theme keeps the correct radio checked under forced-colors', async ({ page }) => {
    await page.goto('/dev/fixture/sample');
    await page.getByRole('button', { name: /^Theme:/i }).click();
    await page.emulateMedia({ forcedColors: 'active' });

    const darkRadio = page.getByRole('radio', { name: 'Dark' });
    await darkRadio.check();
    await expect(darkRadio).toBeChecked();
  });
});
