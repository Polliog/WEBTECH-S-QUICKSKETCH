import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

const backendDir = path.resolve(__dirname, '../backend');
const frontendDir = path.resolve(__dirname, '../frontend');

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './global-setup.ts',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'npm run build && npm run start:prod',
      cwd: backendDir,
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        DRAW_TIME_LIMIT_SECONDS: '5',
        DRAW_TIME_GRACE_SECONDS: '3',
      },
    },
    {
      command: 'npm run start',
      cwd: frontendDir,
      port: 4200,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
