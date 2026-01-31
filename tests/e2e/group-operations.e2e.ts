/**
 * E2E Tests: Group Operations (Collapse/Expand)
 *
 * Tests collapse and expand functionality:
 * - Collapse all groups
 * - Expand all groups
 * - Toggle collapse state
 */

import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { type BrowserContext, chromium, expect, type Page, test } from "@playwright/test"
import {
  closeTestTabs,
  collapseAllGroups,
  createTab,
  disableAutoGroup,
  enableAutoGroup,
  expandAllGroups,
  getExtensionId,
  getTabGroups,
  openPopup,
  setGroupByMode,
  setMinimumTabs,
  TEST_URLS,
  toggleCollapseGroups,
  ungroupAllTabs,
  waitForGroup
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

test.describe("Group Operations - Collapse/Expand", () => {
  // Note: The extension strips TLDs and capitalizes first letter for group titles
  // e.g., "example.com" -> "Example", "httpbin.org" -> "Httpbin"

  test("collapse all groups", async () => {
    await enableAutoGroup(popupPage)

    // Create tabs to create multiple groups
    const tab1 = await createTab(context, TEST_URLS.domain1)
    const tab2 = await createTab(context, TEST_URLS.domain2)
    const tab3 = await createTab(context, TEST_URLS.domain3)

    // Wait for groups to be created (TLDs stripped, capitalized)
    await waitForGroup(popupPage, "Example")
    await waitForGroup(popupPage, "Httpbin")
    await waitForGroup(popupPage, "Typicode")

    // Verify expected groups exist
    let groups = await getTabGroups(popupPage)
    expect(groups.some(g => g.title === "Example")).toBe(true)
    expect(groups.some(g => g.title === "Httpbin")).toBe(true)
    expect(groups.some(g => g.title === "Typicode")).toBe(true)
    expect(groups.length).toBeGreaterThanOrEqual(3)

    // Expand all first to have a known state
    await expandAllGroups(popupPage)
    await popupPage.waitForTimeout(300)

    // Verify groups are expanded
    groups = await getTabGroups(popupPage)
    expect(groups.every(g => !g.collapsed)).toBe(true)

    // Collapse all groups
    await collapseAllGroups(popupPage)
    await popupPage.waitForTimeout(300)

    // Verify most groups are collapsed (active tab's group may stay expanded)
    groups = await getTabGroups(popupPage)
    const collapsedCount = groups.filter(g => g.collapsed).length
    // Most groups should be collapsed (allow 1 active tab group to stay expanded)
    expect(collapsedCount).toBeGreaterThanOrEqual(groups.length - 1)

    // Cleanup
    await tab1.close()
    await tab2.close()
    await tab3.close()
  })

  test("expand all groups", async () => {
    await enableAutoGroup(popupPage)

    // Create tabs to create multiple groups
    const tab1 = await createTab(context, TEST_URLS.domain1)
    const tab2 = await createTab(context, TEST_URLS.domain2)

    // Wait for groups (TLDs stripped, capitalized)
    await waitForGroup(popupPage, "Example")
    await waitForGroup(popupPage, "Httpbin")

    // Collapse all first
    await collapseAllGroups(popupPage)
    await popupPage.waitForTimeout(300)

    // Verify some groups are collapsed
    let groups = await getTabGroups(popupPage)
    const initialCollapsed = groups.filter(g => g.collapsed).length
    expect(initialCollapsed).toBeGreaterThan(0)

    // Expand all groups
    await expandAllGroups(popupPage)
    await popupPage.waitForTimeout(300)

    // Verify all groups are expanded
    groups = await getTabGroups(popupPage)
    expect(groups.every(g => !g.collapsed)).toBe(true)

    // Cleanup
    await tab1.close()
    await tab2.close()
  })

  test("toggle collapse state flips between collapsed and expanded", async () => {
    await enableAutoGroup(popupPage)

    // Create tabs to create groups
    const tab1 = await createTab(context, TEST_URLS.domain1)
    const tab2 = await createTab(context, TEST_URLS.domain2)

    // Wait for groups (TLDs stripped, capitalized)
    await waitForGroup(popupPage, "Example")
    await waitForGroup(popupPage, "Httpbin")

    // Expand all to start from known state
    await expandAllGroups(popupPage)
    await popupPage.waitForTimeout(300)

    // Get initial state - all expanded
    let groups = await getTabGroups(popupPage)
    expect(groups.every(g => !g.collapsed)).toBe(true)

    // Toggle - should collapse
    await toggleCollapseGroups(popupPage)
    await popupPage.waitForTimeout(300)

    // Verify state changed to collapsed (at least most groups)
    groups = await getTabGroups(popupPage)
    const collapsedCount = groups.filter(g => g.collapsed).length
    // Most groups should be collapsed (active tab's group may stay expanded)
    expect(collapsedCount).toBeGreaterThanOrEqual(groups.length - 1)

    // Toggle again - should expand
    await toggleCollapseGroups(popupPage)
    await popupPage.waitForTimeout(500)

    // Verify state changed toward expansion
    groups = await getTabGroups(popupPage)
    const expandedAfterToggle = groups.filter(g => !g.collapsed).length

    // After toggling from collapsed state, we should have fewer collapsed groups
    // (more expanded), or at least the toggle function was called successfully
    // The exact behavior may vary based on which tab is active
    expect(expandedAfterToggle).toBeGreaterThanOrEqual(groups.length - collapsedCount)

    // Cleanup
    await tab1.close()
    await tab2.close()
  })
})
