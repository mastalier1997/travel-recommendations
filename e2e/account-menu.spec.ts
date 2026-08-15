import { test, expect } from '@playwright/test';

// Sign-out itself isn't exercised here — it's a real server action hitting Supabase
// over the network, which would make this suite flaky/network-dependent. This checks
// the menu's structure and accessible naming only.

test.describe('account menu', () => {
  test('shows real identity, never the old placeholder initials', async ({ page }) => {
    await page.goto('/dev/fixture/sample');
    const trigger = page.getByRole('button', { name: /^Account: dev@example\.com$/ });
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.getByText('dev@example.com')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });
});
