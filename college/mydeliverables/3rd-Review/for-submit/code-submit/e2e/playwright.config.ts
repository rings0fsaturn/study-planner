import { config } from 'dotenv';
config({ path: 'apps/app/.env.local' });
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'pnpm --filter @study-tracker/marketing dev',
      url: 'http://localhost:4321',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: 'pnpm dev:full',
      url: 'http://localhost:5173/study/sign-in',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
  projects: [
    {
      name: 'marketing',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:4321',
      },
    },
    {
      name: 'app',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5173',
      },
    },
    {
      name: 'app-mobile',
      testMatch: /roadmap\.spec\.ts/,
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 390, height: 844 },
        baseURL: 'http://localhost:5173',
      },
    },
  ],
});
