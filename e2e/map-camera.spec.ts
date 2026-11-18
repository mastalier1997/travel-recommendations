import { test, expect, type Page } from '@playwright/test';

// MapView's camera rule (components/planner/MapView.tsx, autoFitRef): until the
// user moves the map, the trip stays fitted to whatever size the map has — a
// resize refits. Once they move it themselves, it's theirs: never refitted behind
// them. Wheel zooms used to slip through (MapLibre gives their movestart no
// originalEvent), so a later resize snapped the camera back.

const STUB_STYLE = { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#dde3e6' } }] };

async function open(page: Page, fixture = 'multi-country') {
  await page.route('https://tiles.openfreemap.org/**', (route) => route.fulfill({ json: STUB_STYLE }));
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto(`/dev/fixture/${fixture}`);
  await expect.poll(() => allStopsInView(page)).toBe(true);
}

/** Every marker's centre inside the map canvas. */
function allStopsInView(page: Page) {
  return page.evaluate(() => {
    const map = document.querySelector('[data-testid="map-canvas"]')!.getBoundingClientRect();
    const markers = [...document.querySelectorAll('.maplibregl-marker[data-marker-kind]')];
    return (
      markers.length > 0 &&
      markers.every((m) => {
        const r = m.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        return x > map.left && x < map.right && y > map.top && y < map.bottom;
      })
    );
  });
}

/** Resize the window and give the observer + any refit time to land. */
async function resize(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(800);
}

test('untouched, the camera follows a resize (control case)', async ({ page }) => {
  await open(page);
  // Narrow enough that the old fit no longer holds every stop.
  await resize(page, 700, 800);
  await expect.poll(() => allStopsInView(page)).toBe(true);
});

test('after a wheel zoom, a resize leaves the camera where the user put it', async ({ page }) => {
  await open(page);
  const box = (await page.getByTestId('map-canvas').boundingBox())!;
  await page.mouse.move(box.x + 300, box.y + 300);
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(120);
  }
  await expect.poll(() => allStopsInView(page)).toBe(false);

  await resize(page, 1100, 780);
  expect(await allStopsInView(page)).toBe(false);
});

test('after a drag, a resize leaves the camera where the user put it', async ({ page }) => {
  await open(page);
  const box = (await page.getByTestId('map-canvas').boundingBox())!;
  await page.mouse.move(box.x + 300, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 300 + 600, box.y + 300, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => allStopsInView(page)).toBe(false);

  await resize(page, 1100, 780);
  expect(await allStopsInView(page)).toBe(false);
});

test('"Fit whole trip" hands the camera back to the automatic fit', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(() => allStopsInView(page)).toBe(false);

  await page.getByRole('button', { name: 'Fit whole trip' }).click();
  await expect.poll(() => allStopsInView(page)).toBe(true);
  await resize(page, 700, 800);
  await expect.poll(() => allStopsInView(page)).toBe(true);
});

test('a plan emptied and then given a new first stop fits that stop', async ({ page }) => {
  // Austria + Germany: the camera starts there, the new stop is in Kyoto.
  await open(page);
  const stops = page.getByRole('button', { name: /^Stop \d+ of \d+:/ });
  const count = await stops.count();
  for (let i = 0; i < count; i++) {
    await page.getByRole('button', { name: /^Actions for stop 1,/ }).click();
    await page.getByRole('button', { name: 'Remove from plan' }).click();
  }
  await expect(stops).toHaveCount(0);

  // With no stops there's nothing to search "nearby", so this goes through the
  // (MOCK) geocoder: lib/fixtures/geocode-responses.json's "fushimi inari".
  await page.getByRole('combobox', { name: /search a place/i }).fill('fushimi inari');
  // Scoped (the header's plan-switcher <select> has options too), and the geocoded
  // result — not "Add … as a custom stop", which has no map pin to fit to.
  await page
    .getByRole('listbox', { name: /places near your route/i })
    .getByRole('option', { name: /fushimi inari/i })
    .filter({ hasNotText: /custom stop/i })
    .first()
    .click();
  await expect(stops).toHaveCount(1);

  await expect.poll(() => allStopsInView(page)).toBe(true);
});
