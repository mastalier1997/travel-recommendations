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

  test('explains why a signed-out visitor landed back here, wired to the heading', async ({ page }) => {
    await page.goto('/login?reason=signedout');
    const heading = page.getByRole('heading', { name: 'Sign in to Wanderlist' });
    await expect(heading).toBeVisible();
    const describedBy = await heading.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`#${describedBy}`)).toHaveText("You're signed out.");
  });

  test('explains an expired session, distinct from a fresh sign-out', async ({ page }) => {
    await page.goto('/login?reason=expired');
    await expect(page.getByText(/we sign you out after 30 days/)).toBeVisible();
  });

  test('shows no reason message for a first-time or bare visit', async ({ page }) => {
    await page.goto('/login');
    const heading = page.getByRole('heading', { name: 'Sign in to Wanderlist' });
    expect(await heading.getAttribute('aria-describedby')).toBeNull();
  });
});
