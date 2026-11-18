import { test, expect, type Locator, type Page } from '@playwright/test';

// Pixel 9 portrait. hasTouch makes `(pointer: coarse)` match, which is what turns
// on Graphite's 44px touch targets.
test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });

const TITLE = 'Austria & Germany Road Trip';

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  expect(b, 'element should be rendered').not.toBeNull();
  return b!;
}

function overlaps(a: { x: number; y: number; width: number; height: number }, b: typeof a) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function gotoPlanner(page: Page) {
  // Keep the map deterministic and offline: an empty style, no tiles.
  await page.route('https://tiles.openfreemap.org/**', (route) =>
    route.fulfill({ json: { version: 8, sources: {}, layers: [] } }),
  );
  await page.goto('/dev/fixture/multi-country');
  // The server renders the desktop layout; the mobile one (with the bottom sheet)
  // replaces it right after hydration. Measure only once it has.
  await expect(page.getByRole('button', { name: 'Expand stops list' })).toBeVisible();
}

test.describe('planner header on a phone', () => {
  test('stays one row: title, rename, Export, theme and account side by side', async ({ page }) => {
    await gotoPlanner(page);
    const header = page.locator('header');
    const headerBox = await box(header);
    // One row of 44px controls plus padding — the old layout wrapped to ~110px.
    expect(headerBox.height).toBeLessThanOrEqual(60);

    const title = await box(page.getByRole('heading', { level: 1, name: TITLE }));
    const rename = await box(page.getByRole('button', { name: `Rename plan, ${TITLE}` }));
    const exportBtn = await box(page.getByRole('button', { name: 'Export' }));
    const theme = await box(page.getByRole('button', { name: 'Dark mode' }));
    const account = await box(page.getByRole('button', { name: /^Account:/ }));

    // Same row: every vertical centre within the header's band.
    for (const b of [title, rename, exportBtn, theme, account]) {
      const cy = b.y + b.height / 2;
      expect(cy).toBeGreaterThan(headerBox.y);
      expect(cy).toBeLessThan(headerBox.y + headerBox.height);
    }
    // The rename pencil sits after the title, not wrapped underneath it.
    expect(rename.x).toBeGreaterThan(title.x);
    // Nothing pushed past the right edge.
    expect(account.x + account.width).toBeLessThanOrEqual(412);
  });

  test('header controls meet the 44px touch target', async ({ page }) => {
    await gotoPlanner(page);
    for (const name of [`Rename plan, ${TITLE}`, 'Export', 'Dark mode', /^Account:/]) {
      const b = await box(page.getByRole('button', { name }));
      expect(b.height, String(name)).toBeGreaterThanOrEqual(44);
    }
  });

  test('renaming keeps Save and Cancel on screen', async ({ page }) => {
    await gotoPlanner(page);
    await page.getByRole('button', { name: `Rename plan, ${TITLE}` }).click();
    for (const name of [`Save new name for ${TITLE}`, `Cancel renaming ${TITLE}`]) {
      const button = page.getByRole('button', { name });
      await expect(button).toBeVisible();
      const b = await box(button);
      expect(b.x + b.width, name).toBeLessThanOrEqual(412);
    }
    // The h1 is still there for assistive tech while the input takes the row.
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toHaveCount(1);
  });
});

test('map attribution, scale and controls never overlap above the bottom sheet', async ({ page }) => {
  await gotoPlanner(page);
  const attribution = await box(page.locator('p', { has: page.getByRole('link', { name: 'OpenStreetMap' }) }));
  const fitAll = await box(page.getByRole('button', { name: 'Fit whole trip' }));
  const zoomOut = await box(page.getByRole('button', { name: 'Zoom out' }));
  const scale = await box(page.getByText(/^\d[\d,.]*\s*(km|m)$/));

  expect(overlaps(attribution, fitAll)).toBe(false);
  expect(overlaps(attribution, zoomOut)).toBe(false);
  expect(overlaps(attribution, scale)).toBe(false);

  // All of it above the collapsed sheet.
  const sheetTop = (await box(page.getByRole('button', { name: 'Expand stops list' }))).y;
  for (const b of [attribution, fitAll, scale]) expect(b.y + b.height).toBeLessThanOrEqual(sheetTop);
});

test('import actions: primary full width, the two secondary actions side by side', async ({ page }) => {
  await page.goto('/dev/fixture/import');
  const add = await box(page.getByRole('button', { name: 'Add places' }));
  // exact text: the hidden <input type=file> carries the same accessible name.
  const upload = await box(page.getByRole('button', { name: 'Upload file' }).and(page.getByText('Upload file')));
  const paste = await box(page.getByRole('button', { name: 'Paste from clipboard' }));

  expect(add.width).toBeGreaterThan(412 - 2 * 16 - 2);
  expect(Math.abs(upload.y - paste.y)).toBeLessThan(2);
  expect(upload.y).toBeGreaterThan(add.y);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
