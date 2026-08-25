import { test, expect } from '@playwright/test';

// lib/fixtures/geocode-responses.json: "fushimi inari" auto-accepts (single, high-
// importance candidate near Kyoto); "teamlab" is ambiguous between teamLab
// Botanical Garden (Kansai, near Fushimi Inari) and teamLab Borderless (Tokyo,
// ~370 km away) — the mockup's own "470 km away" scenario.

test('flags a candidate implausibly far from the rest of the import batch', async ({ page }) => {
  await page.goto('/dev/fixture/import');

  await page.getByLabel('One place per line').fill('fushimi inari\nteamlab');
  await page.getByRole('button', { name: 'Add places' }).click();

  const tokyo = page.getByRole('radio', { name: /teamLab Borderless/i });
  const kansai = page.getByRole('radio', { name: /teamLab Botanical Garden/i });
  await expect(tokyo).toBeVisible({ timeout: 20_000 });

  // The warning is inside the radio's own label, so it's part of its accessible name.
  await expect(tokyo).toHaveAccessibleName(/from the rest of this import/i);
  await expect(kansai).not.toHaveAccessibleName(/from the rest of this import/i);
});

test('shows a category chip for a candidate with a recognized OSM tag', async ({ page }) => {
  await page.goto('/dev/fixture/import');

  await page.getByLabel('One place per line').fill('kiyomizu temple');
  await page.getByRole('button', { name: 'Add places' }).click();

  // Kiyomizu-dera is tagged historic/temple in the fixture — labelForOsmTag('historic','temple') → 'Temple'.
  await expect(page.getByRole('radio', { name: /Kiyomizu-dera/i })).toHaveAccessibleName(/temple/i);
});
