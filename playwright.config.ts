import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Next dev compiles each route on first hit — fanning many parallel navigations at a
  // single dev server queues up and blows past per-test timeouts. One worker serializes
  // navigations; a production build (`npm run build && npm start`) wouldn't need this.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  timeout: 45_000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/dev/fixture',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
