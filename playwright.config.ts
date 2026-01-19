import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  fullyParallel: false, // Extension tests should run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Run one test at a time for extension testing
  reporter: [["html"], ["list"]],
  use: {
    headless: false, // Extension testing requires headed mode
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000,
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  }
})
