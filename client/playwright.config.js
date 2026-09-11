import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const uiPort = Number(process.env.E2E_PORT || 5173)
const apiPort = Number(process.env.E2E_API_PORT || 3100)

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: `http://localhost:${uiPort}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: `PORT=${apiPort} npm start`,
      cwd: '../server',
      port: apiPort,
      reuseExistingServer: true,
    },
    {
      command: `VITE_API_URL=http://localhost:${uiPort} DEV_API_URL=http://localhost:${apiPort} npm run dev -- --host localhost --port ${uiPort} --strictPort`,
      url: `http://localhost:${uiPort}`,
      reuseExistingServer: true,
    },
  ],
})
