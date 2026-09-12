import { test, expect } from '@playwright/test';

// The rename control lives in the Planner header (components/planner/Header.tsx),
// exercised here through /dev/fixture/[name]'s FixturePlanner — a local-only
// onRename stub, nothing persists. It recognizes the same 'trigger X error'
// sentinel idiom app/api/geocode/route.ts uses, so the failure branches are
// reachable without stubbing any network call (there's no network call at all
// here — it's a plain prop, same as onSave in other specs).

const TITLE = 'Japan – Spring 2026';

test.describe('rename a plan', () => {
  test('shows a visible heading and a rename trigger with a matching accessible name', async ({ page }) => {
    await page.goto('/dev/fixture/sample');
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    await expect(page.getByRole('button', { name: `Rename plan, ${TITLE}` })).toBeVisible();
  });

  test('opening the editor focuses the input with the full title selected', async ({ page }) => {
    await page.goto('/dev/fixture/sample');
    await page.getByRole('button', { name: `Rename plan, ${TITLE}` }).click();

    const input = page.getByRole('textbox', { name: `New name for ${TITLE}` });
    await expect(input).toBeFocused();
    const selection = await input.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd]);
    expect(selection).toEqual([0, TITLE.length]);
  });

  test('Enter commits the new name, closes the editor, and returns focus to the trigger', async ({ page }) => {
    await page.goto('/dev/fixture/sample');
    await page.getByRole('button', { name: `Rename plan, ${TITLE}` }).click();

    const input = page.getByRole('textbox', { name: `New name for ${TITLE}` });
    await input.fill('Kansai Road Trip');
    await input.press('Enter');

    await expect(page.getByRole('heading', { level: 1, name: 'Kansai Road Trip' })).toBeVisible();
    const trigger = page.getByRole('button', { name: 'Rename plan, Kansai Road Trip' });
    await expect(trigger).toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test('Escape cancels without saving, and reopening shows the still-saved title', async ({ page }) => {
    await page.goto('/dev/fixture/sample');
    const trigger = page.getByRole('button', { name: `Rename plan, ${TITLE}` });
    await trigger.click();

    const input = page.getByRole('textbox', { name: `New name for ${TITLE}` });
    await input.fill('Abandoned Edit');
    await input.press('Escape');

    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(page.getByRole('textbox', { name: `New name for ${TITLE}` })).toHaveValue(TITLE);
  });

  test('the Cancel button behaves the same as Escape', async ({ page }) => {
    await page.goto('/dev/fixture/sample');
    const trigger = page.getByRole('button', { name: `Rename plan, ${TITLE}` });
    await trigger.click();

    await page.getByRole('textbox', { name: `New name for ${TITLE}` }).fill('Abandoned Edit');
    await page.getByRole('button', { name: `Cancel renaming ${TITLE}` }).click();

    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test('blur does not save', async ({ page }) => {
    await page.goto('/dev/fixture/sample');
    await page.getByRole('button', { name: `Rename plan, ${TITLE}` }).click();

    const input = page.getByRole('textbox', { name: `New name for ${TITLE}` });
    await input.fill('Never Saved');
    // Move focus elsewhere without pressing Enter/Save/Escape.
    await page.getByRole('combobox', { name: 'Current plan' }).focus();

    // The editor is still open — blur neither saved nor cancelled it. The heading
    // (which stays mounted throughout editing) still reads the saved title, not
    // the typed one — confirming nothing committed.
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    await expect(input).toHaveValue('Never Saved');
  });

  test('submitting an empty title shows an inline error and keeps the editor open', async ({ page }) => {
    await page.goto('/dev/fixture/sample');
    await page.getByRole('button', { name: `Rename plan, ${TITLE}` }).click();

    const input = page.getByRole('textbox', { name: `New name for ${TITLE}` });
    await input.fill('   ');
    await input.press('Enter');

    await expect(page.getByTestId('rename-error')).toHaveText('Enter a name for this plan.');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toBeFocused();
    // Editor stayed open; the heading (mounted throughout) still shows the saved
    // title, not "Untitled plan" or anything else the server might have coerced.
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    await expect(page.getByText('Untitled plan')).toHaveCount(0);
  });

  test('a save failure keeps the typed text in the input, never silently reverting it', async ({ page }) => {
    await page.goto('/dev/fixture/sample');
    await page.getByRole('button', { name: `Rename plan, ${TITLE}` }).click();

    const input = page.getByRole('textbox', { name: `New name for ${TITLE}` });
    await input.fill('trigger rename error');
    await input.press('Enter');

    await expect(page.getByTestId('rename-error')).toHaveText('Simulated failure for testing.');
    await expect(input).toHaveValue('trigger rename error');
    await expect(input).toBeFocused();
    // Editor stayed open; the heading (mounted throughout) still shows the saved title.
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  });

  test('resubmitting the same (trimmed) title closes the editor without calling onRename', async ({ page }) => {
    await page.goto('/dev/fixture/sample');
    await page.getByRole('button', { name: `Rename plan, ${TITLE}` }).click();

    const input = page.getByRole('textbox', { name: `New name for ${TITLE}` });
    await input.fill(`  ${TITLE}  `); // same title, just extra whitespace
    await input.press('Enter');

    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    await expect(page.getByRole('button', { name: `Rename plan, ${TITLE}` })).toBeFocused();
    const callCount = await page.evaluate(() => (window as unknown as { __renameCallCount?: number }).__renameCallCount ?? 0);
    expect(callCount).toBe(0);
  });

  test('Cancel during a pending save ignores a later successful response, never un-cancelling it', async ({
    page,
  }) => {
    await page.goto('/dev/fixture/sample');
    await page.getByRole('button', { name: `Rename plan, ${TITLE}` }).click();

    const input = page.getByRole('textbox', { name: `New name for ${TITLE}` });
    await input.fill('trigger rename slow');
    await input.press('Enter');
    // The stub takes 500ms — cancel well before it resolves.
    await page.getByRole('button', { name: `Cancel renaming ${TITLE}` }).click();

    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    // Give the slow response time to land, then confirm it never applied.
    await page.waitForTimeout(700);
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'trigger rename slow' })).toHaveCount(0);
  });

  test('the missing-plan branch reads distinctly from the save-conflict banner copy', async ({ page }) => {
    await page.goto('/dev/fixture/sample');
    await page.getByRole('button', { name: `Rename plan, ${TITLE}` }).click();

    const input = page.getByRole('textbox', { name: `New name for ${TITLE}` });
    await input.fill('trigger rename missing');
    await input.press('Enter');

    const alert = page.getByTestId('rename-error');
    await expect(alert).toContainText('could not be found');
    await expect(alert).not.toContainText('changed somewhere else');
  });

  test('no focus black hole on any exit path', async ({ page }) => {
    await page.goto('/dev/fixture/sample');
    const trigger = page.getByRole('button', { name: `Rename plan, ${TITLE}` });

    await trigger.click();
    await page.getByRole('textbox', { name: `New name for ${TITLE}` }).press('Escape');
    let bodyFocused = await page.evaluate(() => document.activeElement === document.body);
    expect(bodyFocused).toBe(false);

    await trigger.click();
    const input = page.getByRole('textbox', { name: `New name for ${TITLE}` });
    await input.fill('New Title');
    await input.press('Enter');
    bodyFocused = await page.evaluate(() => document.activeElement === document.body);
    expect(bodyFocused).toBe(false);
  });

  test('the plan switcher reflects the new title immediately', async ({ page }) => {
    await page.goto('/dev/fixture/sample');
    await page.getByRole('button', { name: `Rename plan, ${TITLE}` }).click();
    const input = page.getByRole('textbox', { name: `New name for ${TITLE}` });
    await input.fill('Renamed Trip');
    await input.press('Enter');

    const switcher = page.getByRole('combobox', { name: 'Current plan' });
    await expect(switcher.locator('option:checked')).toHaveText('Renamed Trip');
  });

  test('mobile: no horizontal overflow, and the input stays at or above 16px to avoid iOS auto-zoom', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dev/fixture/sample');
    await page.getByRole('button', { name: `Rename plan, ${TITLE}` }).click();

    const input = page.getByRole('textbox', { name: `New name for ${TITLE}` });
    const fontSize = await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(16);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
});
