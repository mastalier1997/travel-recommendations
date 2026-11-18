import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// /settings: theme and accent colour, stored on this device.

test('the account menu leads to Settings', async ({ page }) => {
  await page.goto('/dev/fixture/sample');
  await page.getByRole('button', { name: /^Account:/ }).click();
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
});

test('without an account (no-Supabase demo) the header links to Settings directly', async ({ page }) => {
  // e2e runs with no Supabase env, so `/` is the demo planner with no account menu.
  await page.goto('/');
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page).toHaveURL(/\/settings$/);
  // ...and back again.
  await page.getByRole('link', { name: 'Back to the planner' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('the preview takes the picked colour, named in text', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Sky', exact: true }).check();
  await expect(page.getByText('Sky', { exact: true })).toBeVisible();
  await expect(page.getByText('Optimize route')).toHaveCSS('background-color', 'rgb(0, 117, 143)'); // sky, light
});

test('every option is reachable by keyboard: arrow keys move through the colours', async ({ page }) => {
  await page.goto('/settings');
  const violet = page.getByRole('radio', { name: 'Violet', exact: true });
  await violet.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Indigo', exact: true })).toBeChecked();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`/settings has no axe violations (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}
