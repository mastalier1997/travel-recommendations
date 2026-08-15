import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Contrast is computed, not just structural — a pass in light tells you nothing about
// dark. Every fixture route runs under both color schemes.
const FIXTURES = ['sample', 'single-area', 'multi-country'];
const SCHEMES = ['light', 'dark'] as const;

for (const fixture of FIXTURES) {
  for (const scheme of SCHEMES) {
    test(`/dev/fixture/${fixture} has no axe violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`/dev/fixture/${fixture}`);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });
  }
}
