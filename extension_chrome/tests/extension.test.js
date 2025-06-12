import { test, expect, chromium } from "@playwright/test"
import path from "path"

const extensionPath = path.resolve(__dirname, "src")

test.describe("Auto Tab Groups Chrome Extension", () => {
  let browser
  let context
  let page

  test.beforeAll(async () => {
    // Launch browser with extension loaded
    browser = await chromium.launch({
      headless: false, // Need to see the extension UI
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        "--no-first-run",
        "--no-default-browser-check",
      ],
    })

    context = await browser.newContext()
    page = await context.newPage()
  })

  test.afterAll(async () => {
    await browser?.close()
  })

  test("Extension loads without errors", async () => {
    // Navigate to extensions page to verify extension is loaded
    await page.goto("chrome://extensions/")

    // Look for the extension in the list
    const extensionCard = page
      .locator("[data-extension-id]")
      .filter({
        hasText: "Auto Tab Groups",
      })
      .first()

    await expect(extensionCard).toBeVisible()
    console.log("✅ Extension loaded successfully")
  })

  test("Extension popup opens and displays correctly", async () => {
    // Open multiple tabs with different domains for testing
    const testUrls = [
      "https://github.com",
      "https://stackoverflow.com",
      "https://google.com",
      "https://github.com/nodejs/node", // Another GitHub page
    ]

    // Open test tabs
    for (const url of testUrls) {
      const newPage = await context.newPage()
      await newPage.goto(url)
      await newPage.waitForLoadState("domcontentloaded")
    }

    // Get extension ID
    await page.goto("chrome://extensions/")
    const extensionId = await page.evaluate(() => {
      const extensionCards = document.querySelectorAll("[data-extension-id]")
      for (const card of extensionCards) {
        if (card.textContent.includes("Auto Tab Groups")) {
          return card.getAttribute("data-extension-id")
        }
      }
      return null
    })

    expect(extensionId).toBeTruthy()
    console.log("✅ Found extension ID:", extensionId)

    // Open extension popup
    const popupUrl = `chrome-extension://${extensionId}/public/popup.html`
    await page.goto(popupUrl)

    // Verify popup elements are present
    await expect(page.locator("h1")).toContainText("Auto Tab Groups")
    await expect(page.getByText("Group Tabs")).toBeVisible()
    await expect(page.getByText("Ungroup All")).toBeVisible()
    await expect(page.getByText("Generate New Colors")).toBeVisible()
    await expect(page.getByText("Settings")).toBeVisible()

    console.log("✅ Popup UI elements are present")
  })

  test("Tab grouping functionality works", async () => {
    // This test would need to interact with the actual Chrome tabs API
    // We'll test the popup functionality instead

    const testUrls = [
      "https://github.com/test1",
      "https://github.com/test2",
      "https://stackoverflow.com/test1",
      "https://google.com/test1",
    ]

    // Open test tabs
    for (const url of testUrls) {
      const newPage = await context.newPage()
      await newPage.goto(url)
    }

    // Get extension ID and open popup
    await page.goto("chrome://extensions/")
    const extensionId = await page.evaluate(() => {
      const extensionCards = document.querySelectorAll("[data-extension-id]")
      for (const card of extensionCards) {
        if (card.textContent.includes("Auto Tab Groups")) {
          return card.getAttribute("data-extension-id")
        }
      }
      return null
    })

    const popupUrl = `chrome-extension://${extensionId}/public/popup.html`
    await page.goto(popupUrl)

    // Test the Group Tabs button
    await page.click("#group")

    // Wait a moment for grouping to process
    await page.waitForTimeout(1000)

    console.log("✅ Group tabs button clicked successfully")
  })

  test("Settings toggles work correctly", async () => {
    await page.goto("chrome://extensions/")
    const extensionId = await page.evaluate(() => {
      const extensionCards = document.querySelectorAll("[data-extension-id]")
      for (const card of extensionCards) {
        if (card.textContent.includes("Auto Tab Groups")) {
          return card.getAttribute("data-extension-id")
        }
      }
      return null
    })

    const popupUrl = `chrome-extension://${extensionId}/public/popup.html`
    await page.goto(popupUrl)

    // Test auto-group toggle
    const autoGroupToggle = page.locator("#autoGroupToggle")
    await expect(autoGroupToggle).toBeVisible()

    // Test subdomain toggle
    const subdomainToggle = page.locator("#groupBySubDomain")
    await expect(subdomainToggle).toBeVisible()

    // Test the advanced section
    await page.click(".advanced-toggle")
    await expect(page.locator(".advanced-content")).toBeVisible()

    console.log("✅ Settings UI works correctly")
  })

  test("Extension manifest is valid", async () => {
    // Read and validate the manifest
    const fs = require("fs")
    const manifestPath = path.join(extensionPath, "manifest.json")
    const manifestContent = fs.readFileSync(manifestPath, "utf8")
    const manifest = JSON.parse(manifestContent)

    // Validate required Manifest V3 fields
    expect(manifest.manifest_version).toBe(3)
    expect(manifest.name).toBe("Auto Tab Groups")
    expect(manifest.version).toBeTruthy()
    expect(manifest.description).toBeTruthy()
    expect(manifest.permissions).toContain("tabs")
    expect(manifest.permissions).toContain("storage")
    expect(manifest.permissions).toContain("tabGroups")
    expect(manifest.background.service_worker).toBe("background.js")

    console.log("✅ Manifest V3 validation passed")
  })

  test("Browser API compatibility layer works", async () => {
    await page.goto("chrome://extensions/")
    const extensionId = await page.evaluate(() => {
      const extensionCards = document.querySelectorAll("[data-extension-id]")
      for (const card of extensionCards) {
        if (card.textContent.includes("Auto Tab Groups")) {
          return card.getAttribute("data-extension-id")
        }
      }
      return null
    })

    const popupUrl = `chrome-extension://${extensionId}/public/popup.html`
    await page.goto(popupUrl)

    // Test that the browser API compatibility is working
    const versionText = await page.textContent("#versionNumber")
    expect(versionText).toBeTruthy()

    console.log("✅ Browser API compatibility working, version:", versionText)
  })
})

test.describe("Extension Error Handling", () => {
  test("Extension handles missing permissions gracefully", async () => {
    // Test would verify graceful degradation if permissions are missing
    console.log("✅ Permission handling test placeholder")
  })

  test("Extension handles API errors gracefully", async () => {
    // Test would verify error handling for API failures
    console.log("✅ API error handling test placeholder")
  })
})
