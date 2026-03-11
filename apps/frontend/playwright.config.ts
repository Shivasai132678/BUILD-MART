import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e-spec.ts',
  timeout: 60_000,
  expect: {
    timeout: 12_000,
    toMatchSnapshot: { maxDiffPixelRatio: 0.1 },
  },
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: 'list',
  globalSetup: './e2e/support/global-setup.ts',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    headless: process.env.CI === 'true',
    launchOptions: {
      slowMo: process.env.CI === 'true' ? 0 : 100,
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
