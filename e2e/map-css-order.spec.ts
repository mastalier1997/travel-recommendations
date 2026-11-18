import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';

// Regression guard for "the map is empty after I open a plan, fine after F5".
//
// MapLibre adds .maplibregl-map to its container, and maplibre-gl.css gives that
// class `position: relative` — the same specificity as our own positioning class.
// So the stylesheet that loads LAST decides. On a fresh load ours did; but opening
// a plan from /plans (which had already loaded planner.module.css through the
// account menu) appended maplibre-gl.css after it, the container went `relative`,
// collapsed to 0px tall, and the map stayed empty. MapView now gives MapLibre its
// own inner element, so the order can't matter.
//
// The /plans -> plan click needs a signed-in Supabase session, which e2e doesn't
// have — so this recreates the losing order directly: the real maplibre-gl.css,
// appended after everything else, exactly where that navigation put it.

const MAPLIBRE_CSS = readFileSync(
  path.resolve(__dirname, '../node_modules/maplibre-gl/dist/maplibre-gl.css'),
  'utf8',
);

async function open(page: Page) {
  await page.route('https://tiles.openfreemap.org/**', (route) =>
    route.fulfill({ json: { version: 8, sources: {}, layers: [] } }),
  );
  await page.goto('/dev/fixture/multi-country');
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();
}

function mapGeometry(page: Page) {
  return page.evaluate(() => {
    const wrap = document.querySelector('[data-testid="map-wrap"]')!.getBoundingClientRect();
    const box = document.querySelector('[data-testid="map-canvas"]')!.getBoundingClientRect();
    const canvas = document.querySelector('canvas.maplibregl-canvas') as HTMLCanvasElement;
    const markers = [...document.querySelectorAll('.maplibregl-marker[data-marker-kind]')];
    const inView = markers.filter((m) => {
      const r = m.getBoundingClientRect();
      return r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom;
    }).length;
    return {
      wrapH: Math.round(wrap.height),
      boxH: Math.round(box.height),
      canvasH: canvas.clientHeight,
      markers: markers.length,
      inView,
    };
  });
}

for (const [name, viewport] of [
  ['desktop', { width: 1280, height: 800 }],
  ['Pixel 9', { width: 412, height: 915 }],
] as const) {
  test(`map keeps its full size when maplibre-gl.css loads last (${name})`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);
    await page.addStyleTag({ content: MAPLIBRE_CSS });

    await expect
      .poll(async () => {
        const g = await mapGeometry(page);
        return g.boxH === g.wrapH && Math.abs(g.canvasH - g.boxH) <= 1 && g.markers > 0 && g.inView === g.markers;
      })
      .toBe(true);
    expect((await mapGeometry(page)).boxH).toBeGreaterThan(300);
  });
}
