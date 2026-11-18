import { test, expect, type Page } from '@playwright/test';

// Regression guard for "the map is empty until I press F5".
//
// The map used to be constructed at a fixed view (Kyoto, zoom 8) and only moved
// to the trip on MapLibre's 'load' event, which fires once every tile of that
// fixed view has downloaded. On a cold cache, or with one slow tile from the
// keyless tile server, a trip anywhere else showed an empty map with every pin
// off-screen until a refresh served those tiles from cache.
//
// These tests make every tile request hang, so 'load' can never fire. The trip's
// pins must still be on screen: the camera may not depend on tiles at all.
// multi-country = Austria + Germany, deliberately nowhere near the old Kyoto view.

const STUB_STYLE = {
  version: 8,
  sources: {
    v: { type: 'vector', tiles: ['https://tiles.openfreemap.org/stub/{z}/{x}/{y}.pbf'], maxzoom: 14 },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#dde3e6' } },
    { id: 'water', type: 'fill', source: 'v', 'source-layer': 'water', paint: { 'fill-color': '#9fb8cc' } },
  ],
};

async function hangAllTiles(page: Page) {
  await page.route('https://tiles.openfreemap.org/**', (route) => {
    if (route.request().url().includes('/styles/')) return route.fulfill({ json: STUB_STYLE });
    // Never fulfilled: the tile is still pending when the assertions run.
  });
}

/** Markers whose centre lies inside the given vertical band of the map. */
function markersInside(page: Page, bottomInsetPx: number) {
  return page.evaluate((inset) => {
    const map = document.querySelector('[data-testid="map-canvas"]')!.getBoundingClientRect();
    const bottom = map.bottom - inset;
    return [...document.querySelectorAll('.maplibregl-marker[data-marker-kind]')].map((m) => {
      const r = m.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      return x > map.left && x < map.right && y > map.top && y < bottom;
    });
  }, bottomInsetPx);
}

test('desktop: every stop is on screen while tiles are still loading', async ({ page }) => {
  await hangAllTiles(page);
  await page.goto('/dev/fixture/multi-country');
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();

  await expect
    .poll(async () => {
      const inside = await markersInside(page, 0);
      return inside.length > 0 && inside.every(Boolean);
    }, { timeout: 5000 })
    .toBe(true);
});

test('Pixel 9: every stop is on screen and above the bottom sheet while tiles are still loading', async ({
  page,
}) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await hangAllTiles(page);
  await page.goto('/dev/fixture/multi-country');
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();

  // The collapsed sheet covers the bottom 190px of the map (SHEET_PEEK_PX).
  await expect
    .poll(async () => {
      const inside = await markersInside(page, 190);
      return inside.length > 0 && inside.every(Boolean);
    }, { timeout: 5000 })
    .toBe(true);
});
