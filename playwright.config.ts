import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    timezoneId: 'Asia/Shanghai',
  },
  projects: [
    {
      name: 'mobile-edge',
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        channel: 'msedge',
      },
    },
  ],
  webServer: {
    command:
      'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
