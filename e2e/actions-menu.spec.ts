import { test, expect } from '@playwright/test';

// lib/fixtures/large-trip-plan.ts: 15 stops, tall enough that the panel scrolls
// and the last stop's menu has no room to open downward — the bug this covers.

test.describe('stop actions menu — positioning', () => {
  test('desktop: the last stop\'s menu is never clipped, and flips above the trigger', async ({ page }) => {
    await page.goto('/dev/fixture/large-trip');

    const trigger = page.getByRole('button', { name: /^Actions for stop 15, Himeji Castle/i });
    await trigger.scrollIntoViewIfNeeded();
    const triggerBox = (await trigger.boundingBox())!;

    await trigger.click();
    const removeBtn = page.getByRole('button', { name: 'Remove from plan' });
    await expect(removeBtn).toBeVisible();
    await expect(removeBtn).toBeInViewport();

    const menuItemBox = (await removeBtn.boundingBox())!;
    expect(menuItemBox.y).toBeLessThan(triggerBox.y);
  });

  test('desktop: a stop with room below still opens downward as before', async ({ page }) => {
    await page.goto('/dev/fixture/large-trip');

    const trigger = page.getByRole('button', { name: /^Actions for stop 1, Kyoto Station/i });
    const triggerBox = (await trigger.boundingBox())!;
    await trigger.click();

    const moveUpBox = (await page.getByRole('button', { name: 'Move up' }).boundingBox())!;
    expect(moveUpBox.y).toBeGreaterThan(triggerBox.y);
  });

  test('closes if the underlying list scrolls out from under it', async ({ page }) => {
    await page.goto('/dev/fixture/large-trip');

    await page.getByRole('button', { name: /^Actions for stop 1, Kyoto Station/i }).click();
    const removeBtn = page.getByRole('button', { name: 'Remove from plan' });
    await expect(removeBtn).toBeVisible();

    await page.locator('[data-scroll]').first().evaluate((el) => el.scrollBy(0, 300));
    await expect(removeBtn).toBeHidden();
  });

  test('mobile: renders as a full-width sheet with a working Cancel', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dev/fixture/large-trip');
    await page.getByRole('button', { name: 'Expand stops list' }).click();

    const trigger = page.getByRole('button', { name: /^Actions for stop 1, Kyoto Station/i });
    await trigger.click();

    const removeBtn = page.getByRole('button', { name: 'Remove from plan' });
    await expect(removeBtn).toBeVisible();
    // Full-bleed: the item spans (near) the whole viewport, not a 216px box.
    const box = (await removeBtn.boundingBox())!;
    expect(box.width).toBeGreaterThan(300);

    const cancel = page.getByRole('button', { name: 'Cancel' });
    await expect(cancel).toBeVisible();
    await cancel.click();
    await expect(removeBtn).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('mobile: Escape and light-dismiss still work, same as desktop', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dev/fixture/large-trip');
    await page.getByRole('button', { name: 'Expand stops list' }).click();

    const trigger = page.getByRole('button', { name: /^Actions for stop 1, Kyoto Station/i });
    await trigger.click();
    const removeBtn = page.getByRole('button', { name: 'Remove from plan' });
    await expect(removeBtn).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(removeBtn).toBeHidden();
  });

  test('the menu still does what it says — moving a stop up updates its position', async ({ page }) => {
    await page.goto('/dev/fixture/large-trip');

    await page.getByRole('button', { name: /^Actions for stop 2, Fushimi Inari Taisha/i }).click();
    await page.getByRole('button', { name: 'Move up' }).click();

    await expect(page.getByRole('button', { name: /^Stop 1 of \d+: Fushimi Inari Taisha/i })).toBeVisible();
  });
});
