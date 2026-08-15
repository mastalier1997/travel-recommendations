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

  test('jumping to a country does not scroll the page header off-screen', async ({ page }) => {
    // Short viewport so the panel actually needs to scroll — otherwise scrollIntoView
    // has nothing to do and the regression can't reproduce. Regression: .countryHeading
    // is a scrollIntoView target that is itself position:sticky, which triggers a known
    // browser quirk of over-scrolling ancestor scroll containers — including .shell,
    // which `overflow:hidden` (silently a scroll container despite no scrollbar) let
    // scrollIntoView push by the overshoot, taking the real <header> off-screen with it.
    await page.setViewportSize({ width: 1280, height: 480 });
    const nav = page.getByRole('navigation', { name: /jump to country/i });
    await nav.getByRole('link', { name: /^Germany/i }).click();
    await expect(page.getByRole('banner')).toBeInViewport();
    await expect(page.getByText('Wanderlist')).toBeInViewport();
  });

  test('the filter/jump-chips bar stays visible after jumping to a country', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 480 });
    const nav = page.getByRole('navigation', { name: /jump to country/i });
    await nav.getByRole('link', { name: /^Germany/i }).click();
    await expect(nav).toBeInViewport();
    await expect(page.getByRole('searchbox')).toBeInViewport();
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
