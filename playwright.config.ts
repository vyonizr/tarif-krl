import { defineConfig, devices } from '@playwright/test'

const MOCK_SERVER_PORT = 9321
const KCI_BASE_URL = `http://localhost:${MOCK_SERVER_PORT}/api/krl`
const MRT_MOCK_SERVER_PORT = 9322
const MRT_MIDDLEWARE_BASE_URL = `http://localhost:${MRT_MOCK_SERVER_PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: `node e2e/mock-server.mjs`,
      port: MOCK_SERVER_PORT,
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: String(MOCK_SERVER_PORT),
      },
    },
    {
      command: `node e2e/mrt-mock-server.mjs`,
      port: MRT_MOCK_SERVER_PORT,
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: String(MRT_MOCK_SERVER_PORT),
      },
    },
    {
      command: 'npm run build && npm run start',
      port: 3000,
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
      env: {
        KCI_BASE_URL,
        MRT_MIDDLEWARE_BASE_URL,
        NEXT_PUBLIC_SUPABASE_KEY: process.env.NEXT_PUBLIC_SUPABASE_KEY ?? '',
        SUPABASE_URL: process.env.SUPABASE_URL ?? '',
      },
    },
  ],
})
