import { test, expect } from '@playwright/test';

// lib/fixtures/large-trip-plan.ts: 15 stops, above OSRM_TRIP_MAX_STOPS (12) but
// under MAX_STOPS_SOLVED (100) — exercises the heuristic solver (lib/routing/solve.ts)
// instead of OSRM's own /trip. MOCK is forced on for this whole suite
// (playwright.config.ts) so this runs the real solver against a haversine matrix,
// zero network, deterministic.

test.describe('heuristic solve (>12 stops)', () => {
  test('reflects the new 100-stop cap, not the old 12-stop one', async ({ page }) => {
    await page.goto('/dev/fixture/large-trip');
    await expect(page.getByText('15 stops', { exact: true })).toBeVisible();
    // Below MAX_STOPS_SOLVED, order-solving always happens — exact vs heuristic is
    // deliberately invisible to the user, so the label is the same "Optimize route"
    // a 9-stop plan would show, not the old over-cap "Route" label.
    await expect(page.getByRole('button', { name: 'Optimize route' })).toBeVisible();
    await expect(page.getByText(/100 stops max per auto-optimize/)).toBeVisible();
  });

  test('clicking Optimize actually reorders stops above the old 12-stop cap', async ({ page }) => {
    await page.goto('/dev/fixture/large-trip');
    const cardNames = () => page.getByRole('button', { name: /^Stop \d+ of 15:/ }).allTextContents();

    const before = await cardNames();
    expect(before).toHaveLength(15);

    await page.getByRole('button', { name: 'Optimize route' }).click();
    await expect(page.getByRole('button', { name: 'Re-optimize' })).toBeVisible({ timeout: 10_000 });

    const after = await cardNames();
    expect(after).toHaveLength(15);
    expect(after).not.toEqual(before);
    // Same 15 stops, just a different order — nothing dropped or duplicated. Strip
    // the "Stop N of 15:" ordinal first: it's expected to change per-name (that's
    // what reordering means), only the underlying set of names should be stable.
    const placeName = (s: string) => s.replace(/^Stop \d+ of 15:\s*/, '');
    expect([...after].map(placeName).sort()).toEqual([...before].map(placeName).sort());
  });
});
