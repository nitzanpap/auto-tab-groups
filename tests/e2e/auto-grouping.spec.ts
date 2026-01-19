/**
 * E2E Tests: Auto-Grouping Toggle
 *
 * Tests auto-grouping enable/disable behavior:
 * - Groups tabs when enabled
 * - Does not group when disabled
 * - Manual grouping works when disabled
 * - Ungroup all functionality
 */

import { test, expect, chromium, type BrowserContext, type Page } from "@playwright/test"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import {
  getExtensionId,
  openPopup,
  createTab,
  enableAutoGroup,
  disableAutoGroup,
  ungroupAllTabs,
  groupAllTabs,
  waitForGroup,
  waitForTabInGroup,
  waitForTabUngrouped,
  waitForNoGroups,
  waitForGroupCount,
  getTabGroups,
  getTabs,
  closeTestTabs,
  setMinimumTabs,
  setGroupByMode,
  getAutoGroupState,
  TEST_URLS
} from "./helpers/extension-helpers"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const extensionPath = join(__dirname, "../../.output/chrome-mv3")

let context: BrowserContext
let extensionId: string
let popupPage: Page

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  })
  extensionId = await getExtensionId(context)
})

test.afterAll(async () => {
  await context.close()
})

test.beforeEach(async () => {
  await closeTestTabs(context)
  popupPage = await openPopup(context, extensionId)
  await disableAutoGroup(popupPage)
  await ungroupAllTabs(popupPage)
  await setMinimumTabs(popupPage, 1)
  await setGroupByMode(popupPage, "domain")
})

test.afterEach(async () => {
  if (popupPage && !popupPage.isClosed()) {
    await disableAutoGroup(popupPage)
    await ungroupAllTabs(popupPage)
    await popupPage.close()
  }
  await closeTestTabs(context)
})

test.describe("Auto-Grouping Toggle", () => {
  // Note: The extension strips TLDs from domain names for group titles
  // e.g., "example.com" -> "example", "httpbin.org" -> "httpbin"

  test("groups tabs automatically when auto-group is enabled", async () => {
    // Enable auto-grouping first
    await enableAutoGroup(popupPage)

    // Verify it's enabled
    const isEnabled = await getAutoGroupState(popupPage)
    expect(isEnabled).toBe(true)

    // Create tabs - they should be grouped automatically
    const tab1 = await createTab(context, TEST_URLS.domain1)
    const tab2 = await createTab(context, TEST_URLS.domain1Page2)

    // Wait for automatic grouping (TLD stripped)
    await waitForTabInGroup(popupPage, "example.com", "example")

    // Verify group was created
    const groups = await getTabGroups(popupPage)
    expect(groups.some(g => g.title === "example")).toBe(true)

    // Cleanup
    await tab1.close()
    await tab2.close()
  })

  test("does not group tabs when auto-group is disabled", async () => {
    // Ensure auto-grouping is disabled
    await disableAutoGroup(popupPage)

    // Verify it's disabled
    const isEnabled = await getAutoGroupState(popupPage)
    expect(isEnabled).toBe(false)

    // Create tabs
    const tab1 = await createTab(context, TEST_URLS.domain1)
    const tab2 = await createTab(context, TEST_URLS.domain1Page2)

    // Wait a moment to ensure no grouping happens
    await popupPage.waitForTimeout(1000)

    // Verify tabs are NOT grouped
    const tabs = await getTabs(popupPage)
    const exampleTabs = tabs.filter(
      t => t.url.includes("example.com") && !t.url.includes("chrome-extension")
    )

    expect(exampleTabs.length).toBe(2)
    expect(exampleTabs.every(t => t.groupId === -1)).toBe(true)

    // Verify no groups exist
    const groups = await getTabGroups(popupPage)
    expect(groups.length).toBe(0)

    // Cleanup
    await tab1.close()
    await tab2.close()
  })

  test("manual group button works when auto-group is disabled", async () => {
    // Ensure auto-grouping is disabled
    await disableAutoGroup(popupPage)

    // Create tabs (they won't be auto-grouped)
    const tab1 = await createTab(context, TEST_URLS.domain1)
    const tab2 = await createTab(context, TEST_URLS.domain2)

    // Verify no groups with our test domains initially
    await popupPage.waitForTimeout(500)
    let groups = await getTabGroups(popupPage)
    expect(groups.some(g => g.title === "example")).toBe(false)
    expect(groups.some(g => g.title === "httpbin")).toBe(false)

    // Click the Group button to manually group tabs
    await groupAllTabs(popupPage)

    // Wait for groups to be created (TLDs stripped)
    await waitForGroup(popupPage, "example")
    await waitForGroup(popupPage, "httpbin")

    // Verify our expected groups were created (may have additional system groups)
    groups = await getTabGroups(popupPage)
    expect(groups.some(g => g.title === "example")).toBe(true)
    expect(groups.some(g => g.title === "httpbin")).toBe(true)

    // Cleanup
    await tab1.close()
    await tab2.close()
  })

  test("ungroup all removes all tab groups", async () => {
    // Enable auto-grouping and create grouped tabs
    await enableAutoGroup(popupPage)

    const tab1 = await createTab(context, TEST_URLS.domain1)
    const tab2 = await createTab(context, TEST_URLS.domain2)

    // Wait for groups to be created (TLDs stripped)
    await waitForGroup(popupPage, "example")
    await waitForGroup(popupPage, "httpbin")

    // Verify our expected groups exist
    let groups = await getTabGroups(popupPage)
    expect(groups.some(g => g.title === "example")).toBe(true)
    expect(groups.some(g => g.title === "httpbin")).toBe(true)

    // Disable auto-group first to prevent re-grouping
    await disableAutoGroup(popupPage)

    // Click Ungroup All
    await ungroupAllTabs(popupPage)

    // Verify no groups remain
    await waitForNoGroups(popupPage)

    groups = await getTabGroups(popupPage)
    expect(groups.length).toBe(0)

    // Verify tabs are ungrouped
    const tabs = await getTabs(popupPage)
    const httpTabs = tabs.filter(
      t => t.url.startsWith("http") && !t.url.includes("chrome-extension")
    )
    expect(httpTabs.every(t => t.groupId === -1)).toBe(true)

    // Cleanup
    await tab1.close()
    await tab2.close()
  })
})
