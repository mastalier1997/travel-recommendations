import { test, expect } from '@playwright/test';

// Regression guard for the production-only "map blank until refresh" bug: on a
// first-ever client-side navigation, the map's CSS chunk can apply a beat after
// MapView's init effect runs, so the container is still 0-height at the instant
// `new maplibregl.Map(...)` measures it. MapLibre has its own internal
// ResizeObserver but discards its FIRST delivery as redundant with construction —
// if 0 -> real size happens within that single delivery, MapLibre never learns
// the container changed, and the canvas is stuck at its ~300px fallback until
// something else (a manual refresh) forces a fresh mount.
//
// Reproducing that exact first-delivery race deterministically from outside the
// page — via Playwright, against a dev server whose first-compile latency
// varies too much to line up with React's mount instant — turned out not to be
// practical. What this test verifies instead: MapView's own ResizeObserver (the
// actual fix — a second, independent observer that discards nothing) fires and
// calls `map.resize()` when its container resizes post-mount. A dev-only
// counter (`window.__mapResizeObserverFired`, dead code in production — see
// MapView.tsx) confirms THIS code path ran specifically, rather than only that
// the canvas ends up the right size — which MapLibre's own observer already
// achieves on its own for any non-first delivery, so a size-only assertion
// can't tell a working fix from a coincidentally-passing one.
test('MapView\'s own resize observer fires and resizes the canvas on a post-mount container resize', async ({
  page,
}) => {
  await page.goto('/dev/fixture/sample');
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();

  const firedCount = (): Promise<number> =>
    page.evaluate(() => (window as unknown as { __mapResizeObserverFired?: number }).__mapResizeObserverFired ?? 0);

  const sizeOf = () =>
    page.evaluate(() => {
      const container = document.querySelector('[data-testid="map-canvas"]') as HTMLElement | null;
      const canvas = container?.querySelector('canvas.maplibregl-canvas') as HTMLCanvasElement | null;
      if (!container || !canvas) return null;
      return { containerH: container.getBoundingClientRect().height, canvasClientH: canvas.clientHeight };
    });

  const beforeCollapse = await firedCount();

  // Collapse the container the same way a not-yet-applied CSS chunk would —
  // via the flex ancestor, not the absolutely-positioned canvas div itself.
  await page.addStyleTag({ content: '[data-testid="map-wrap"] { height: 0 !important; }' });
  // Wait for the observer to actually have delivered the collapse (not just for
  // layout to reflect it) before capturing the baseline below — otherwise a very
  // fast environment could capture it before the async callback runs.
  await expect.poll(firedCount, { timeout: 3000 }).toBeGreaterThan(beforeCollapse);
  const afterCollapse = await firedCount();

  // Grow it back — the "CSS chunk finally applies" moment.
  await page.evaluate(() => {
    document.querySelectorAll('style').forEach((s) => {
      if (s.textContent?.includes('map-wrap') && s.textContent.includes('height: 0')) s.remove();
    });
  });

  await expect.poll(firedCount, { timeout: 3000 }).toBeGreaterThan(afterCollapse);

  const after = await sizeOf();
  expect(after?.containerH).toBeGreaterThan(300);
  expect(after?.canvasClientH).toBeGreaterThan(300);
  expect(Math.abs(after!.canvasClientH - after!.containerH)).toBeLessThan(2);
});
