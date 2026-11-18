import { test, expect } from '@playwright/test';

// The Wanderlist mark (Ink & One Line, option B: two pins joined by the route).
// app/icon.svg is the tab icon and the header logo; app/apple-icon.png is the
// iPhone home-screen icon (iOS ignores SVG touch icons).

test('the page declares the SVG tab icon and the PNG touch icon', async ({ page }) => {
  await page.goto('/dev/fixture/sample');
  const icon = page.locator('link[rel="icon"][type="image/svg+xml"]');
  await expect(icon).toHaveAttribute('href', /\/icon\.svg/);
  const touch = page.locator('link[rel="apple-touch-icon"]');
  await expect(touch).toHaveAttribute('href', /\/apple-icon\.png/);
  await expect(touch).toHaveAttribute('sizes', '180x180');

  const svg = await page.request.get('/icon.svg');
  expect(svg.ok()).toBe(true);
  expect(svg.headers()['content-type']).toContain('image/svg+xml');
  const png = await page.request.get('/apple-icon.png');
  expect(png.ok()).toBe(true);
  expect(png.headers()['content-type']).toContain('image/png');
});

test('the header shows the mark at 32px, inside the home link', async ({ page }) => {
  await page.goto('/dev/fixture/sample');
  const home = page.getByRole('link', { name: 'Wanderlist — home' });
  const mark = home.locator('img');
  await expect(mark).toHaveAttribute('src', '/icon.svg');
  // Actually loaded and painted, not a broken image.
  await expect.poll(() => mark.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
  const box = await mark.boundingBox();
  expect(box?.width).toBe(32);
  expect(box?.height).toBe(32);
});

test('on a phone the mark alone is the home link, with a 44px target', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto('/dev/fixture/sample');
  const home = page.getByRole('link', { name: 'Wanderlist — home' });
  await expect(home.getByText('Wanderlist')).toBeHidden();
  await expect(home.locator('img')).toBeVisible();
  const box = await home.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
});
