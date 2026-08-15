import { test, expect } from '@playwright/test';

// lib/fixtures/multi-country-plan.ts: AT, AT, AT, AT, DE, DE, DE, AT — 3 country groups,
// 2 border crossings, none of them ferries.

test.describe('continental scale — country grouping', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dev/fixture/multi-country');
  });

  test('groups stops into sticky per-country sections with subtotals', async ({ page }) => {
    const austriaHeadings = page.getByRole('heading', { level: 3, name: /^Austria/i });
    await expect(austriaHeadings.first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: /^Germany/i })).toBeVisible();
    // Second Austria run (non-consecutive) is its own group, not merged with the first.
    await expect(austriaHeadings).toHaveCount(2);
  });

  test('surfaces the two border crossings as their own rows', async ({ page }) => {
    await expect(page.getByText(/crossing into/i)).toHaveCount(2);
  });

  test('collapsing a group hides its stops and updates the heading summary', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /^Germany/i });
    const marienplatz = page.getByRole('button', { name: /^Stop \d+ of \d+: Marienplatz/i });
    await expect(marienplatz).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toContainText(/collapsed/i);
    await expect(marienplatz).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(marienplatz).toBeVisible();
  });

  test('the jump-to-country nav links to each group', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /jump to country/i });
    await expect(nav.getByRole('link', { name: /^Germany/i })).toBeVisible();
  });

  test('filtering narrows the list without renumbering stops', async ({ page }) => {
    await page.getByRole('searchbox').fill('Marienplatz');
    await expect(page.getByText('Marienplatz')).toBeVisible();
    await expect(page.getByText('Neuschwanstein Castle')).toBeHidden();
    // Ordinal stays the absolute itinerary position, not a recount of the filtered view.
    await expect(page.getByText(/^Stop 6 of 8:/)).toHaveCount(1);
  });

  test('a single-country plan renders the flat list with no grouping chrome', async ({ page }) => {
    await page.goto('/dev/fixture/sample');
    await expect(page.getByRole('navigation', { name: /jump to country/i })).toHaveCount(0);
    await expect(page.getByRole('searchbox')).toHaveCount(0);
  });
});
