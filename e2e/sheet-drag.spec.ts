import { test, expect, type Page } from '@playwright/test';

// The mobile bottom sheet (components/planner/BottomSheet.tsx): the handle and the
// summary under it can be dragged. The sheet follows the pointer, then snaps open
// or closed — by direction on a quick flick, otherwise by which side of halfway
// it was released. The handle is still a button: tap and keyboard keep working.

test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });

async function open(page: Page) {
  await page.route('https://tiles.openfreemap.org/**', (route) =>
    route.fulfill({ json: { version: 8, sources: {}, layers: [] } }),
  );
  await page.goto('/dev/fixture/sample');
  await expect(page.getByRole('button', { name: 'Expand stops list' })).toBeVisible();
}

const sheetTop = (page: Page) =>
  page.evaluate(() =>
    Math.round(document.querySelector('[data-testid="sheet-drag-area"]')!.closest('section')!.getBoundingClientRect().top),
  );

const isOpen = (page: Page) => page.getByRole('button', { name: 'Collapse stops list' }).count().then((n) => n === 1);

/** Press on the drag area's handle row and move vertically in `steps` steps of
 * `stepPx`, pausing `pauseMs` between them (slow = a deliberate drag, no pause =
 * a flick). Returns the sheet's top while still held, before release. */
async function drag(page: Page, stepPx: number, steps: number, pauseMs: number) {
  const area = (await page.getByTestId('sheet-drag-area').boundingBox())!;
  const x = area.x + area.width / 2;
  const y = area.y + 22; // the handle row
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x, y + i * stepPx);
    if (pauseMs) await page.waitForTimeout(pauseMs);
  }
  const heldTop = await sheetTop(page);
  await page.mouse.up();
  return heldTop;
}

test('the sheet follows the pointer while held', async ({ page }) => {
  await open(page);
  const start = await sheetTop(page);
  const held = await drag(page, -20, 10, 30); // 200px up, slowly
  expect(Math.abs(start - 200 - held)).toBeLessThanOrEqual(2);
});

test('dragged up past halfway it opens; dragged back down past halfway it closes', async ({ page }) => {
  await open(page);
  await drag(page, -40, 12, 40); // 480px up, slowly
  await expect.poll(() => isOpen(page)).toBe(true);
  await expect.poll(() => sheetTop(page)).toBeLessThan(150);

  await drag(page, 40, 12, 40); // 480px down, slowly
  await expect.poll(() => isOpen(page)).toBe(false);
});

test('a short, slow drag snaps back where it was', async ({ page }) => {
  await open(page);
  const start = await sheetTop(page);
  await drag(page, -10, 8, 60); // 80px up at ~0.17px/ms: neither far nor fast
  await expect.poll(() => sheetTop(page)).toBe(start);
  expect(await isOpen(page)).toBe(false);
});

test('a quick flick decides by direction, however short', async ({ page }) => {
  await open(page);
  await drag(page, -30, 3, 0); // 90px up, fast
  await expect.poll(() => isOpen(page)).toBe(true);

  await drag(page, 30, 3, 0); // 90px down, fast
  await expect.poll(() => isOpen(page)).toBe(false);
});

test('the click after a drag is not mistaken for a tap on the handle', async ({ page }) => {
  await open(page);
  // At peek the sheet can't go lower: press, move down, release — all on the
  // handle. Without the guard, the browser's click would toggle it open.
  await drag(page, 10, 3, 30);
  await page.waitForTimeout(400);
  expect(await isOpen(page)).toBe(false);
});

test('tapping the handle, and the keyboard, still toggle it', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Expand stops list' }).click();
  await expect.poll(() => isOpen(page)).toBe(true);

  const collapse = page.getByRole('button', { name: 'Collapse stops list' });
  await collapse.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => isOpen(page)).toBe(false);
});

test('buttons inside the draggable area still work on a tap', async ({ page }) => {
  await open(page);
  const optimize = page.waitForRequest('**/api/optimize');
  await page.getByRole('button', { name: /^(Optimize route|Re-optimize)$/ }).click();
  await optimize;
});
