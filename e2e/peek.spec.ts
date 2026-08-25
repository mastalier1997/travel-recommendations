import { test, expect } from '@playwright/test';

// lib/fixtures/peek-plan.ts: Portugal (6 stops, past PEEK_N=4) then Spain (2 stops).

test.describe('sidebar peek — large country groups', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dev/fixture/peek');
  });

  test('shows only the first 4 stops of a 6-stop group, plus a "+N more" reveal', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^Stop \d+ of \d+: Livraria Lello/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Stop \d+ of \d+: Clérigos Tower/i })).toBeHidden();
    await expect(page.getByRole('button', { name: /\+2 more in Portugal/i })).toBeVisible();
  });

  test('clicking "+N more" reveals the rest and moves focus to the first newly-revealed stop', async ({ page }) => {
    await page.getByRole('button', { name: /\+2 more in Portugal/i }).click();
    // Peek showed stops 1-4 (Porto Cathedral..Ribeira District); the 5th, Palácio
    // da Bolsa, is the first stop this reveal newly shows — not the last (6th).
    const firstNew = page.getByRole('button', { name: /^Stop \d+ of \d+: Palácio da Bolsa/i });
    await expect(firstNew).toBeVisible();
    await expect(firstNew).toBeFocused();
    await expect(page.getByRole('button', { name: /^Stop \d+ of \d+: Clérigos Tower/i })).toBeVisible();
  });

  test('the footer names how many stops are hidden and offers "Expand all"', async ({ page }) => {
    await expect(page.getByText(/^Showing \d+ of 8 stops$/)).toBeVisible();
    await page.getByRole('button', { name: /^Expand all$/ }).click();
    await expect(page.getByRole('button', { name: /^Stop \d+ of \d+: Clérigos Tower/i })).toBeVisible();
    await expect(page.getByText(/^Showing \d+ of 8 stops$/)).toHaveCount(0);
  });

  test('filtering shows every match regardless of peek', async ({ page }) => {
    await page.getByRole('searchbox').fill('Clérigos');
    await expect(page.getByRole('button', { name: /^Stop \d+ of \d+: Clérigos Tower/i })).toBeVisible();
  });
});
