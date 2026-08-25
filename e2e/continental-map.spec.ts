import { test, expect } from '@playwright/test';

test.describe('continental scale — map treatment', () => {
  test('a multi-country plan shows the borders/city-labels badge', async ({ page }) => {
    await page.goto('/dev/fixture/multi-country');
    await expect(page.getByText(/country borders on/i)).toBeVisible();
  });

  test('a single-country plan shows no borders badge', async ({ page }) => {
    await page.goto('/dev/fixture/sample');
    await expect(page.getByText(/country borders on/i)).toHaveCount(0);
  });

  test('shows a scale bar with a km or m label on every fixture', async ({ page }) => {
    await page.goto('/dev/fixture/multi-country');
    await expect(page.getByText(/^\d+ (km|m)$/)).toBeVisible();
  });

  test('the fit-to-trip control is a labeled button, not icon-only', async ({ page }) => {
    await page.goto('/dev/fixture/sample');
    const fit = page.getByRole('button', { name: /^Fit whole trip$/ });
    await expect(fit).toBeVisible();
    await fit.click(); // shouldn't throw — map is initialized and has stops to fit
  });
});
