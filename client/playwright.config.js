import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'PORT=3100 npm start',
      cwd: '../server',
      port: 3100,
      reuseExistingServer: true,
    },
    {
      command: 'VITE_API_URL=http://localhost:3100 npm run dev -- --host 127.0.0.1',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
    },
  ],
})
