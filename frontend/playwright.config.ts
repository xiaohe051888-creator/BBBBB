import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:8011';

export default defineConfig({
  testDir: './tests-e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'python -m uvicorn app.api.main:app --host 0.0.0.0 --port 8011 --log-level warning',
    url: `${baseURL}/`,
    reuseExistingServer: true,
    cwd: '../backend',
    timeout: 60_000,
    env: {
      ...process.env,
      E2E_TESTING: 'true',
    },
  },
});
