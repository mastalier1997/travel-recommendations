import { test, expect } from '@playwright/test';

// lib/fixtures/nearby-pois.json: Nishiki Tenmangū Shrine, Nishiki Warai, and Nishiki
// Market — the last one shares coordinates with SAMPLE_PLAN's own Nishiki Market stop.

test.describe('add a stop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dev/fixture/sample');
  });

  test('typing opens a listbox of nearby suggestions', async ({ page }) => {
    const search = page.getByRole('combobox', { name: /search a place/i });
    await search.fill('nishiki');
    const listbox = page.getByRole('listbox', { name: /places near your route/i });
    await expect(listbox).toBeVisible();
    await expect(page.getByRole('option', { name: /Nishiki Tenmangū Shrine/i })).toBeVisible();
  });

  test('a suggestion already on the plan is marked and not addable', async ({ page }) => {
    const search = page.getByRole('combobox', { name: /search a place/i });
    await search.fill('nishiki market');
    const already = page.getByRole('option', { name: /already on your route/i });
    await expect(already).toBeVisible();
    await expect(already).toHaveAttribute('aria-disabled', 'true');

    const before = await page.getByRole('list').first().getByRole('listitem').count();
    // aria-disabled="true" makes Playwright refuse a normal click — that's the
    // correct behavior to prove: force through it and confirm nothing happened.
    await already.click({ force: true });
    // No-op: the stops list is unchanged.
    await expect(page.getByRole('list').first().getByRole('listitem')).toHaveCount(before);
  });

  test('selecting a new nearby suggestion adds it to the route', async ({ page }) => {
    const summaryBefore = await page.getByText(/^\d+ stops$/).first().textContent();
    const search = page.getByRole('combobox', { name: /search a place/i });
    await search.fill('Nishiki Tenmangū');
    await page.getByRole('option', { name: /Nishiki Tenmangū Shrine/i }).click();

    await expect(page.getByRole('button', { name: /^Stop \d+ of \d+: Nishiki Tenmangū Shrine/i })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /added nishiki tenmangū shrine/i })).toHaveText(
      /added nishiki tenmangū shrine to your route/i,
    );
    const summaryAfter = await page.getByText(/^\d+ stops$/).first().textContent();
    expect(summaryAfter).not.toBe(summaryBefore);
  });

  test('keyboard: arrow down opens and moves through options, enter selects', async ({ page }) => {
    const search = page.getByRole('combobox', { name: /search a place/i });
    await search.fill('nishiki');
    await search.press('ArrowDown');
    await search.press('ArrowDown');
    await expect(search).toHaveAttribute('aria-activedescendant', /.+/);
    await search.press('Enter');
    // Whatever got added shows up as a new stop and the input clears.
    await expect(search).toHaveValue('');
  });

  test('escape closes the listbox without clearing the typed text', async ({ page }) => {
    const search = page.getByRole('combobox', { name: /search a place/i });
    await search.fill('nishiki');
    await expect(page.getByRole('listbox')).toBeVisible();
    await search.press('Escape');
    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(search).toHaveValue('nishiki');
  });

  test('a query with no nearby match falls back to "add as custom stop"', async ({ page }) => {
    const search = page.getByRole('combobox', { name: /search a place/i });
    await search.fill('some place nobody has heard of xyz');
    const custom = page.getByRole('option', { name: /add.*as a custom stop.*no map pin/i });
    await expect(custom).toBeVisible();
    await custom.click();
    await expect(
      page.getByRole('button', { name: /^Stop \d+ of \d+: some place nobody has heard of xyz/i }),
    ).toBeVisible();
  });
});
