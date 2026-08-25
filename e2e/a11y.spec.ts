import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Contrast is computed, not just structural — a pass in light tells you nothing about
// dark. Every fixture route runs under both color schemes.
const FIXTURES = ['sample', 'single-area', 'multi-country', 'large-trip', 'peek', 'import'];
const SCHEMES = ['light', 'dark'] as const;

// axe never sees inside a closed popover — this scans them open too, which also
// retroactively covers ExportMenu/CardActions, never actually exercised before.
async function openPopovers(page: Page) {
  for (const name of [/^Export$/, /^Theme:/, /^Account:/]) {
    const trigger = page.getByRole('button', { name });
    if (await trigger.count()) await trigger.first().click();
  }
  // AddStopSearch is a combobox, not a popover trigger — open its listbox the same
  // way a real user would, by typing (MOCK-mode /api/nearby returns fixture POIs).
  const search = page.getByRole('combobox', { name: /search a place/i });
  if (await search.count()) {
    await search.first().fill('nishiki');
    await page.waitForTimeout(400); // clears the geocode debounce
  }
}

for (const fixture of FIXTURES) {
  for (const scheme of SCHEMES) {
    test(`/dev/fixture/${fixture} has no axe violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`/dev/fixture/${fixture}`);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });

    test(`/dev/fixture/${fixture} has no axe violations with menus open (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`/dev/fixture/${fixture}`);
      await openPopovers(page);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });
  }
}
