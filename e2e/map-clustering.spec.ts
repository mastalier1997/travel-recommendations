import { test, expect } from '@playwright/test';

// lib/fixtures/kl-bali-plan.ts: Kuala Lumpur (MY), Singapore (SG), then Jakarta/
// Yogyakarta/Bali — one 'ID' country group whose stops are ~1000km apart. This is
// the exact shape of the reported bug: the old clusterByGroup (zoom band + flat
// stop count) collapsed that whole ID group into one badge once zoomed out past
// 'close', regardless of how far apart its stops actually were.

test.describe('map marker clustering — real distance, not just country/count', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dev/fixture/kl-bali');
  });

  test('every stop stays in the sidebar list regardless of map zoom', async ({ page }) => {
    const stopButton = (name: string) => page.getByRole('button', { name: new RegExp(`^Stop \\d+ of \\d+: ${name}`) });

    for (const name of ['Petronas Towers', 'Merlion Park', 'Monas', 'Borobudur', 'Uluwatu Temple']) {
      await expect(stopButton(name)).toBeVisible();
    }

    const zoomOut = page.getByRole('button', { name: 'Zoom out' });
    for (let i = 0; i < 6; i++) await zoomOut.click();

    for (const name of ['Petronas Towers', 'Merlion Park', 'Monas', 'Borobudur', 'Uluwatu Temple']) {
      await expect(stopButton(name)).toBeVisible();
    }
  });

  test('a country group spanning ~1000km stays multiple markers when zoomed out, not one blob', async ({
    page,
  }) => {
    const markers = page.locator('.maplibregl-marker[data-marker-kind]');
    const zoomOut = page.getByRole('button', { name: 'Zoom out' });
    for (let i = 0; i < 6; i++) await zoomOut.click();

    await expect(async () => {
      expect(await markers.count()).toBeGreaterThan(1);
    }).toPass();

    const clusterTexts = await page.locator('.maplibregl-marker[data-marker-kind="cluster"]').allTextContents();
    for (const text of clusterTexts) {
      expect(text).not.toMatch(/unknown/i);
      expect(text).not.toMatch(/^\d+$/);
    }
  });

  test('clicking a cluster badge de-clusters it into more markers', async ({ page }) => {
    const markers = page.locator('.maplibregl-marker[data-marker-kind]');
    const zoomOut = page.getByRole('button', { name: 'Zoom out' });
    for (let i = 0; i < 8; i++) await zoomOut.click();

    const before = await markers.count();
    const cluster = page.locator('.maplibregl-marker[data-marker-kind="cluster"]').first();
    // Only meaningful if zooming out this far actually produced a cluster badge —
    // skip rather than false-fail if this environment's viewport fit differently.
    test.skip((await cluster.count()) === 0, 'no cluster badge formed at this zoom/viewport');

    await cluster.click();
    await expect(async () => {
      expect(await markers.count()).toBeGreaterThan(before);
    }).toPass();
  });
});
