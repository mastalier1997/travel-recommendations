import { test, expect } from '@playwright/test';

// A row stuck in 'error' (geocoder failed) or 'none' (no matches) used to have no way
// to get a decision, which permanently blocked "Confirm N places" for the whole batch —
// including rows that resolved fine. 'trigger geocode error' is a MOCK-only sentinel
// (app/api/geocode/route.ts) standing in for a real network failure.
test('a stuck error/no-match row can be dismissed, unblocking the rest of the import', async ({ page }) => {
  await page.goto('/dev/fixture/import');

  await page
    .getByLabel('One place per line')
    .fill('trigger geocode error\nfushimi inari\nthat ramen place near the station');
  await page.getByRole('button', { name: 'Add places' }).click();

  // Generous timeout: first hit of /api/geocode on the dev server pays a one-time
  // route-compile cost on top of the three sequential (concurrency-1) mock lookups.
  await expect(page.getByText('Could not reach the geocoder.', { exact: false })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText('No matches for', { exact: false })).toBeVisible();

  // Confirms the bug as reported: three rows in, only one resolved cleanly, and the
  // batch is not committable yet.
  await page.getByRole('button', { name: 'Confirm 3 places' }).click();
  await expect(page.getByText('Confirm 2 more places before continuing:')).toBeVisible();

  await page
    .getByRole('button', { name: 'Skip — keep “trigger geocode error” as plain text' })
    .click();

  await page
    .getByRole('button', { name: 'Remove "that ramen place near the station" from this import' })
    .click();

  await expect(page.getByText('No matches for', { exact: false })).toHaveCount(0);
  await expect(
    page.getByText('Removed "that ramen place near the station". 2 places left.'),
  ).toBeVisible();

  // Removing a row unmounts its own button — this is the focus-black-hole check.
  const bodyFocused = await page.evaluate(() => document.activeElement === document.body);
  expect(bodyFocused).toBe(false);

  await expect(page.getByRole('button', { name: 'Confirm 2 places' })).toBeEnabled();
});
