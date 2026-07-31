import { type BrowserContext, expect, test } from "@playwright/test"
import {
  getAutoGroupState,
  getExtensionId,
  launchExtensionContext
} from "./helpers/extension-helpers"

let context: BrowserContext
let extensionId: string

test.beforeAll(async () => {
  context = await launchExtensionContext()

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

    // Check version is displayed (should match semver pattern)
    const versionElement = page.locator("#versionNumber")
    await expect(versionElement).toBeVisible()
    const version = await versionElement.textContent()
    expect(version).toMatch(/^\d+\.\d+\.\d+$/)

    await page.close()
  })

  test("auto-group toggle works", async () => {
    const popupUrl = `chrome-extension://${extensionId}/popup.html`
    const page = await context.newPage()
    await page.goto(popupUrl)

    const toggle = page.locator("#autoGroupToggle")

    // The popup fills its toggles from the background asynchronously. Reading
    // the checkbox before that lands returns the markup default rather than the
    // stored setting, so "initial state" would be a lie and the assertions below
    // would flip-flop — which is exactly how this failed on a slower CI runner.
    const initialState = await getAutoGroupState(page)
    await expect(toggle).toBeChecked({ checked: initialState })

    // Click the label (visible toggle) to change checkbox state
    await page.locator("label.switch").first().click()
    await expect(toggle).toBeChecked({ checked: !initialState })

    // Toggle back
    await page.locator("label.switch").first().click()
    await expect(toggle).toBeChecked({ checked: initialState })

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
