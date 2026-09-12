import { test, expect, type Page, type Route as PWRoute } from '@playwright/test';

// app/api/optimize/route.ts's OsrmUnroutableError-with-diagnosis path (a stop
// whose coordinate can't attach to any road at all) can't be reached through
// MOCK mode — MOCK always succeeds. Stubbing the client's own fetch to
// /api/optimize is what actually exercises the 422 branch this suite is
// testing, same idea as MOCK itself: no network, deterministic, but this time
// hitting the failure path on purpose.
async function stubOptimizeFailure(page: Page, body: Record<string, unknown>) {
  await page.route('**/api/optimize', (route: PWRoute) =>
    route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

const optimizeButton = (page: Page) => page.getByRole('button', { name: /^(Optimize route|Re-optimize)$/ });

// A road gap between two otherwise-fine stops (e.g. Kuala Lumpur -> Jakarta) is
// no longer an error at all — it's routed with a direct (straight-line) leg
// instead (lib/routing/osrm.ts). The only case that still 422s is a stop cut
// off from literally everything, which usually means its own coordinate can't
// attach to any road (a bad geocode, or a pin out in open water).
test.describe('optimize failure: an unsnappable stop', () => {
  test('names the stop, focuses the alert, and removing it clears the alert', async ({ page }) => {
    await page.goto('/dev/fixture/sample');
    await stubOptimizeFailure(page, {
      error: "One of these stops doesn't seem to be reachable by road…",
      unreachable: { stopId: 'pl_fushimi' },
    });

    await optimizeButton(page).click();

    // Scoped past Next.js's own (permanently mounted, empty) role="alert" route
    // announcer — getByRole alone would otherwise match both.
    const alert = page.getByRole('alert').filter({ hasText: 'Fushimi Inari Taisha' });
    await expect(alert).toBeVisible();
    await expect(alert).toBeFocused();

    const removeBtn = page.getByRole('button', { name: 'Remove Fushimi Inari Taisha from plan' });
    await expect(removeBtn).toBeVisible();

    await removeBtn.click();

    // The removed stop is the only thing the diagnosis named — the whole alert
    // clears rather than lingering with a dead action.
    await expect(alert).not.toBeVisible();
    await expect(page.getByRole('button', { name: /^Stop \d+ of \d+: Fushimi Inari Taisha/ })).toHaveCount(0);
  });

  test('an undiagnosed failure degrades to a generic 502 message with no dead actions', async ({ page }) => {
    await page.goto('/dev/fixture/sample');
    await page.route('**/api/optimize', (route) =>
      route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'Could not reach the routing service.' }) }),
    );

    await optimizeButton(page).click();

    const alert = page.getByRole('alert').filter({ hasText: 'Could not reach the routing service.' });
    await expect(alert).toBeVisible();
    await expect(alert).toBeFocused();
    await expect(alert.getByRole('button')).toHaveCount(0);
  });

  test('no keyboard trap: tab reaches past the alert into the stops list', async ({ page }) => {
    await page.goto('/dev/fixture/sample');
    await stubOptimizeFailure(page, {
      error: "One of these stops doesn't seem to be reachable by road…",
      unreachable: { stopId: 'pl_fushimi' },
    });

    await optimizeButton(page).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Fushimi Inari Taisha' })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Remove Fushimi Inari Taisha from plan' })).toBeFocused();
  });
});

// The kl-bali fixture (lib/fixtures/kl-bali-plan.ts) carries a real gap-tolerant
// route: KL -> Singapore and Jakarta -> Borobudur are real drives, Singapore ->
// Jakarta and Borobudur -> Uluwatu have no road route at all (direct legs) — one
// crossing a country boundary, one within the same country, so both PlaceList's
// entry-leg row and PlaceCard's own per-stop row get exercised.
test.describe('a route containing direct (no-road-route) legs', () => {
  test('every direct leg reads as a direct line, distance-only, never a fabricated drive', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto('/dev/fixture/kl-bali');

    // Cross-country direct leg (Singapore -> Jakarta), rendered by PlaceList's
    // country-crossing row.
    const crossing = page.getByText(/Direct line · Merlion Park → Monas/);
    await expect(crossing).toBeVisible();
    await expect(crossing).toContainText('no road route found');
    await expect(crossing).toContainText('Not driving distance or time');

    // Same-country direct leg (Borobudur -> Uluwatu, both Indonesia) — the case
    // that used to be silently mode-blind on the per-stop card row.
    const sameCountry = page.getByText(/Direct line · .*straight line from Borobudur/);
    await expect(sameCountry).toBeVisible();
    await expect(sameCountry).toContainText('no road route found');

    // Never a bare "0 min" anywhere — a direct leg has no real driving time.
    await expect(page.getByText(/\b0 min\b/)).toHaveCount(0);

    // The trip total discloses that time excludes the direct legs — both the
    // visible summary note and the sr-only status text say so.
    await expect(page.getByText(/excludes 2 direct-line legs with no road route/).first()).toBeVisible();

    // The map's own dashed-overlay legend — its casing/dash layers are built
    // from route.legs in the same effect this navigation just exercised.
    await expect(page.getByText('Dashed line · direct line, no road route')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
