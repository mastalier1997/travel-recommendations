import { test, expect, type Page, type Route as PWRoute } from '@playwright/test';

// app/api/optimize/route.ts's OsrmUnroutableError path (a real Kuala Lumpur <->
// Jakarta trip, say) can't be reached through MOCK mode — MOCK always succeeds.
// Stubbing the client's own fetch to /api/optimize is what actually exercises the
// 422-with-diagnosis branch this suite is testing, same idea as MOCK itself: no
// network, deterministic, but this time hitting the failure path on purpose.
async function stubOptimizeFailure(page: Page, body: Record<string, unknown>) {
  await page.route('**/api/optimize', (route: PWRoute) =>
    route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

const optimizeButton = (page: Page) => page.getByRole('button', { name: /^(Optimize route|Re-optimize)$/ });

test.describe('optimize failure: unreachable stop(s)', () => {
  test('names the stop, focuses the alert, and removing it clears the alert', async ({ page }) => {
    await page.goto('/dev/fixture/sample');
    await stubOptimizeFailure(page, {
      error: 'No route found between these stops…',
      unreachable: { kind: 'isolated', confident: true, stopIds: ['pl_fushimi'] },
    });

    await optimizeButton(page).click();

    // Scoped past Next.js's own (permanently mounted, empty) role="alert" route
    // announcer — getByRole alone would otherwise match both.
    const alert = page.getByRole('alert').filter({ hasText: 'Fushimi Inari Taisha' });
    await expect(alert).toBeVisible();
    await expect(alert).toBeFocused();

    // Only one action for a confident single culprit — remove, not show.
    await expect(page.getByRole('button', { name: /^Show/ })).toHaveCount(0);
    const removeBtn = page.getByRole('button', { name: 'Remove Fushimi Inari Taisha from plan' });
    await expect(removeBtn).toBeVisible();

    await removeBtn.click();

    // The removed stop is the only thing the diagnosis named — the whole alert
    // clears rather than lingering with a dead action.
    await expect(alert).not.toBeVisible();
    await expect(page.getByRole('button', { name: /^Stop \d+ of \d+: Fushimi Inari Taisha/ })).toHaveCount(0);
  });

  test('a non-confident split names every side and offers Show + Remove per candidate', async ({ page }) => {
    await page.goto('/dev/fixture/sample');
    const rest = ['pl_kiyomizu', 'pl_arashiyama', 'pl_dotonbori', 'pl_osakacastle', 'pl_teamlab', 'pl_nara', 'pl_kobe'];
    await stubOptimizeFailure(page, {
      error: 'No route found between these stops…',
      unreachable: {
        kind: 'split',
        confident: false,
        stopIds: ['pl_fushimi', 'pl_nishiki'],
        groups: [rest, ['pl_fushimi', 'pl_nishiki']],
      },
    });

    await optimizeButton(page).click();

    // Scoped past Next.js's own (permanently mounted, empty) role="alert" route
    // announcer. Broad on purpose — the exact wording changes once a candidate is
    // removed below, but it always mentions a road route.
    const alert = page.getByRole('alert').filter({ hasText: /road route/i });
    await expect(alert).toContainText('Fushimi Inari Taisha and Nishiki Market');
    await expect(alert).toBeFocused();

    await expect(page.getByRole('button', { name: 'Show Fushimi Inari Taisha' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show Nishiki Market' })).toBeVisible();

    await page.getByRole('button', { name: 'Show Nishiki Market' }).click();
    await expect(page.getByRole('button', { name: /^Stop \d+ of 9: Nishiki Market/ })).toBeFocused();

    // Removing one candidate leaves the alert up with just the other.
    await page.getByRole('button', { name: 'Remove Nishiki Market' }).click();
    await expect(alert).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show Fushimi Inari Taisha' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Nishiki Market/ })).toHaveCount(0);
  });

  test('an inconclusive diagnosis degrades to the plain message with no dead actions', async ({ page }) => {
    await page.goto('/dev/fixture/sample');
    await stubOptimizeFailure(page, { error: 'Could not optimize this route.' });

    await optimizeButton(page).click();

    const alert = page.getByRole('alert').filter({ hasText: 'Could not optimize this route.' });
    await expect(alert).toBeVisible();
    await expect(alert).toBeFocused();
    await expect(alert.getByRole('button')).toHaveCount(0);
  });

  test('no keyboard trap: tab reaches past the alert into the stops list', async ({ page }) => {
    await page.goto('/dev/fixture/sample');
    await stubOptimizeFailure(page, {
      error: 'No route found between these stops…',
      unreachable: { kind: 'isolated', confident: true, stopIds: ['pl_fushimi'] },
    });

    await optimizeButton(page).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Fushimi Inari Taisha' })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Remove Fushimi Inari Taisha from plan' })).toBeFocused();
  });
});
