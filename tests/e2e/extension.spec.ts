import { test, expect, chromium, type BrowserContext } from "@playwright/test"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const extensionPath = join(__dirname, "../../.output/chrome-mv3")

let context: BrowserContext
let extensionId: string

/**
 * Wait for and retrieve the extension ID from service workers
 */
async function getExtensionId(ctx: BrowserContext): Promise<string> {
  return new Promise<string>(resolve => {
    const checkServiceWorker = () => {
      const workers = ctx.serviceWorkers()
      for (const worker of workers) {
        const url = worker.url()
        if (url.includes("chrome-extension://")) {
          resolve(url.split("/")[2])
          return
        }
      }
      setTimeout(checkServiceWorker, 100)
    }
    checkServiceWorker()
  })
}

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  })

  // Get extension ID once and reuse across all tests
  extensionId = await getExtensionId(context)
})

test.afterAll(async () => {
  await context.close()
})

test.describe("Auto Tab Groups Extension", () => {
  test("extension loads and popup opens", async () => {
    expect(extensionId).toBeTruthy()

    // Open the popup
    const popupUrl = `chrome-extension://${extensionId}/popup.html`
    const page = await context.newPage()
    await page.goto(popupUrl)

    // Verify popup elements are present
    await expect(page.locator("#group")).toBeVisible()
    await expect(page.locator("#ungroup")).toBeVisible()

    // Check the toggle switch label is visible (checkbox input is hidden, styled as toggle)
    await expect(page.locator("label.switch").first()).toBeVisible()
    // Verify the checkbox exists in DOM
    await expect(page.locator("#autoGroupToggle")).toBeAttached()

    // Check version is displayed
    const versionElement = page.locator("#versionNumber")
    await expect(versionElement).toBeVisible()
    const version = await versionElement.textContent()
    expect(version).toBe("2.0.0")

    await page.close()
  })

  test("auto-group toggle works", async () => {
    const popupUrl = `chrome-extension://${extensionId}/popup.html`
    const page = await context.newPage()
    await page.goto(popupUrl)

    const toggle = page.locator("#autoGroupToggle")
    const initialState = await toggle.isChecked()

    // Click the label (visible toggle) to change checkbox state
    await page.locator("label.switch").first().click()
    await page.waitForTimeout(500)

    // Verify state changed
    const newState = await toggle.isChecked()
    expect(newState).toBe(!initialState)

    // Toggle back
    await page.locator("label.switch").first().click()
    await page.waitForTimeout(500)

    // Verify state restored
    const restoredState = await toggle.isChecked()
    expect(restoredState).toBe(initialState)

    await page.close()
  })

  test("rules section expands", async () => {
    const popupUrl = `chrome-extension://${extensionId}/popup.html`
    const page = await context.newPage()
    await page.goto(popupUrl)

    // Find and click the rules toggle
    const rulesToggle = page.locator(".rules-toggle")
    await expect(rulesToggle).toBeVisible()

    await rulesToggle.click()
    await page.waitForTimeout(300)

    // Verify rules content is visible
    const rulesContent = page.locator(".rules-content")
    await expect(rulesContent).toHaveClass(/expanded/)

    // Verify add rule button is visible
    const addRuleButton = page.locator("#addRuleButton")
    await expect(addRuleButton).toBeVisible()

    await page.close()
  })

  test("sidebar loads correctly", async () => {
    const sidebarUrl = `chrome-extension://${extensionId}/sidebar.html`
    const page = await context.newPage()
    await page.goto(sidebarUrl)

    // Verify sidebar elements are present (same as popup)
    await expect(page.locator("#group")).toBeVisible()
    await expect(page.locator("#ungroup")).toBeVisible()

    // Check the toggle switch label is visible
    await expect(page.locator("label.switch").first()).toBeVisible()
    await expect(page.locator("#autoGroupToggle")).toBeAttached()

    await page.close()
  })
})
