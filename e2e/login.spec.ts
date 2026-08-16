import { test, expect } from '@playwright/test';

test.describe('login', () => {
  test('offers Google alongside the magic-link form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
  });

  test('Google button starts the Supabase OAuth redirect', async ({ page }) => {
    await page.goto('/login');
    const authorizeRequest = page.waitForRequest((req) => req.url().includes('/auth/v1/authorize'));
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    const request = await authorizeRequest;
    expect(new URL(request.url()).searchParams.get('provider')).toBe('google');
  });
});
