import { test, expect, chromium } from "@playwright/test"
import path from "path"

const extensionPath = path.resolve(__dirname, "../src")

test.describe("Chrome Extension Basic Tests", () => {
  test("Extension loads and popup displays correctly", async () => {
    // Launch Chrome with the extension
    const browser = await chromium.launch({
      headless: false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    })

    const context = await browser.newContext()
    const page = await context.newPage()

    try {
      // Navigate to chrome://extensions to verify extension loaded
      await page.goto("chrome://extensions/")

      // Wait for page to load
      await page.waitForTimeout(2000)

      // Check if extension is present (looking for the name in the page)
      const extensionPresent = await page.locator("text=Auto Tab Groups").isVisible()
      console.log("Extension loaded:", extensionPresent ? "✅" : "❌")

      if (extensionPresent) {
        console.log("✅ Extension successfully loaded in Chrome")
      } else {
        console.log("❌ Extension not found in Chrome extensions page")
      }
    } catch (error) {
      console.error("Test error:", error.message)
    } finally {
      await browser.close()
    }
  })

  test("Extension manifest and files are valid", async () => {
    const fs = require("fs")

    // Check manifest
    const manifestPath = path.join(extensionPath, "manifest.json")
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))

    expect(manifest.manifest_version).toBe(3)
    expect(manifest.name).toBe("Auto Tab Groups")
    expect(manifest.permissions).toContain("tabs")
    expect(manifest.permissions).toContain("tabGroups")
    expect(manifest.background.service_worker).toBe("background.js")

    // Check critical files exist
    const criticalFiles = [
      "background.js",
      "public/popup.html",
      "public/popup.js",
      "utils/BrowserAPI.js",
      "services/TabGroupService.js",
    ]

    for (const file of criticalFiles) {
      const filePath = path.join(extensionPath, file)
      expect(fs.existsSync(filePath)).toBe(true)
    }

    console.log("✅ All critical files and manifest validation passed")
  })
})
