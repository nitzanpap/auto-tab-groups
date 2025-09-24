import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  fullyParallel: false, // Extensions tests should run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Run one test at a time for extension testing
  reporter: "html",
  use: {
    baseURL: "http://localhost:5174/",
    headless: false, // Extension testing requires headed mode
    viewport: { width: 1280, height: 720 },
    actionTimeout: 0,
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: "npx http-server -p 5174 .",
    port: 5174,
    reuseExistingServer: true,
    timeout: 120000
  },
  projects: [
    {
      name: "chromium",
      use: {
        channel: "chrome"
      }
    }
  ]
})
