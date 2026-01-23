/**
 * E2E Tests: Auto-Collapse / Focus Mode
 *
 * Tests the auto-collapse feature that automatically collapses
 * inactive tab groups when switching tabs.
 */

import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { type BrowserContext, chromium, expect, type Page, test } from "@playwright/test"
import {
  activateTab,
  closeTestTabs,
  createTab,
  disableAutoCollapse,
  disableAutoGroup,
  enableAutoCollapse,
  enableAutoGroup,
  expandAllGroups,
  getActiveTab,
  getAutoCollapseState,
  getExtensionId,
  getTabGroups,
  openPopup,
  setGroupByMode,
  setMinimumTabs,
  TEST_URLS,
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
  await disableAutoCollapse(popupPage)
  await ungroupAllTabs(popupPage)
  await setMinimumTabs(popupPage, 1)
  await setGroupByMode(popupPage, "domain")
})

test.afterEach(async () => {
  if (popupPage && !popupPage.isClosed()) {
    await disableAutoGroup(popupPage)
    await disableAutoCollapse(popupPage)
    await ungroupAllTabs(popupPage)
    await popupPage.close()
  }
  await closeTestTabs(context)
})

test.describe("Auto-Collapse Feature", () => {
  test("auto-collapse state can be enabled and disabled via message", async () => {
    // Initially disabled
    let state = await getAutoCollapseState(popupPage)
    expect(state.enabled).toBe(false)
    expect(state.delayMs).toBe(0)

    // Enable with default delay (0)
    await enableAutoCollapse(popupPage)
    state = await getAutoCollapseState(popupPage)
    expect(state.enabled).toBe(true)
    expect(state.delayMs).toBe(0)

    // Enable with custom delay
    await enableAutoCollapse(popupPage, 500)
    state = await getAutoCollapseState(popupPage)
    expect(state.enabled).toBe(true)
    expect(state.delayMs).toBe(500)

    // Disable
    await disableAutoCollapse(popupPage)
    state = await getAutoCollapseState(popupPage)
    expect(state.enabled).toBe(false)
  })

  test("should collapse other groups when switching tabs (immediate mode)", async () => {
    // Enable auto-grouping first to create groups
    await enableAutoGroup(popupPage)

    // Create tabs in different domains to create groups
    const tab1 = await createTab(context, TEST_URLS.domain1)
    const tab2 = await createTab(context, TEST_URLS.domain2)
    const tab3 = await createTab(context, TEST_URLS.domain3)

    // Wait for groups to be created
    await waitForGroup(popupPage, "example")
    await waitForGroup(popupPage, "httpbin")
    await waitForGroup(popupPage, "typicode")

    // Expand all groups first
    await expandAllGroups(popupPage)
    await popupPage.waitForTimeout(300)

    // Verify all groups are expanded
    let groups = await getTabGroups(popupPage)
    expect(groups.every(g => !g.collapsed)).toBe(true)

    // Enable auto-collapse with immediate mode (0ms delay)
    await enableAutoCollapse(popupPage, 0)

    // Activate a tab in domain1 group
    await activateTab(popupPage, "example.com")
    await popupPage.waitForTimeout(500)

    // Get the active tab's group
    const activeTab = await getActiveTab(popupPage)
    expect(activeTab).not.toBeNull()

    // Verify other groups collapsed
    groups = await getTabGroups(popupPage)
    const activeGroup = groups.find(g => g.id === activeTab?.groupId)

    if (activeGroup) {
      // The active group should be expanded
      expect(activeGroup.collapsed).toBe(false)

      // Other groups should be collapsed
      const otherGroups = groups.filter(g => g.id !== activeGroup.id)
      console.log("Active group:", activeGroup.title, "collapsed:", activeGroup.collapsed)
      console.log(
        "Other groups:",
        otherGroups.map(g => `${g.title}: collapsed=${g.collapsed}`)
      )

      // At least some other groups should be collapsed
      const collapsedCount = otherGroups.filter(g => g.collapsed).length
      expect(collapsedCount).toBeGreaterThan(0)
    }

    // Cleanup
    await tab1.close()
    await tab2.close()
    await tab3.close()
  })

  test("should NOT collapse groups when auto-collapse is disabled", async () => {
    // Enable auto-grouping to create groups
    await enableAutoGroup(popupPage)

    // Create tabs
    const tab1 = await createTab(context, TEST_URLS.domain1)
    const tab2 = await createTab(context, TEST_URLS.domain2)

    // Wait for groups
    await waitForGroup(popupPage, "example")
    await waitForGroup(popupPage, "httpbin")

    // Expand all groups
    await expandAllGroups(popupPage)
    await popupPage.waitForTimeout(300)

    // Verify expanded
    let groups = await getTabGroups(popupPage)
    expect(groups.every(g => !g.collapsed)).toBe(true)

    // Keep auto-collapse DISABLED
    await disableAutoCollapse(popupPage)

    // Switch tabs
    await activateTab(popupPage, "httpbin.org")
    await popupPage.waitForTimeout(500)

    // Groups should still be expanded (no auto-collapse)
    groups = await getTabGroups(popupPage)
    const expandedCount = groups.filter(g => !g.collapsed).length
    expect(expandedCount).toBe(groups.length)

    // Cleanup
    await tab1.close()
    await tab2.close()
  })

  test("should collapse all groups when active tab is ungrouped", async () => {
    // Enable auto-grouping
    await enableAutoGroup(popupPage)

    // Create tabs
    const tab1 = await createTab(context, TEST_URLS.domain1)
    const tab2 = await createTab(context, TEST_URLS.domain2)

    // Wait for groups
    await waitForGroup(popupPage, "example")
    await waitForGroup(popupPage, "httpbin")

    // Expand all
    await expandAllGroups(popupPage)
    await popupPage.waitForTimeout(300)

    // Enable auto-collapse
    await enableAutoCollapse(popupPage, 0)

    // Activate the popup page (which is not in any group)
    await popupPage.bringToFront()
    await popupPage.waitForTimeout(500)

    // All groups should be collapsed since active tab is ungrouped
    const groups = await getTabGroups(popupPage)
    const collapsedCount = groups.filter(g => g.collapsed).length
    console.log(
      "Groups after activating ungrouped tab:",
      groups.map(g => `${g.title}: collapsed=${g.collapsed}`)
    )

    // Most or all groups should be collapsed
    expect(collapsedCount).toBeGreaterThanOrEqual(groups.length - 1)

    // Cleanup
    await tab1.close()
    await tab2.close()
  })

  test("should expand active group if it was collapsed", async () => {
    // Enable auto-grouping
    await enableAutoGroup(popupPage)

    // Create tabs
    const tab1 = await createTab(context, TEST_URLS.domain1)
    const tab2 = await createTab(context, TEST_URLS.domain2)

    // Wait for groups
    await waitForGroup(popupPage, "example")
    await waitForGroup(popupPage, "httpbin")

    // Collapse all groups first
    await popupPage.evaluate(async () => {
      const groups = await chrome.tabGroups.query({})
      for (const group of groups) {
        await chrome.tabGroups.update(group.id, { collapsed: true })
      }
    })
    await popupPage.waitForTimeout(300)

    // Verify all collapsed
    let groups = await getTabGroups(popupPage)
    expect(groups.every(g => g.collapsed)).toBe(true)

    // Enable auto-collapse
    await enableAutoCollapse(popupPage, 0)

    // Activate a tab in domain1 group
    await activateTab(popupPage, "example.com")
    await popupPage.waitForTimeout(500)

    // The active group should be expanded now
    const activeTab = await getActiveTab(popupPage)
    groups = await getTabGroups(popupPage)
    const activeGroup = groups.find(g => g.id === activeTab?.groupId)

    if (activeGroup) {
      console.log(
        "Active group after activation:",
        activeGroup.title,
        "collapsed:",
        activeGroup.collapsed
      )
      expect(activeGroup.collapsed).toBe(false)
    }

    // Cleanup
    await tab1.close()
    await tab2.close()
  })

  test("UI elements for auto-collapse exist in popup", async () => {
    // Check that the auto-collapse toggle exists (checkbox is hidden inside custom switch)
    const toggle = popupPage.locator("#autoCollapseToggle")
    await expect(toggle).toBeAttached()

    // Check that the delay container exists (but is hidden initially)
    const delayContainer = popupPage.locator("#collapseDelayContainer")
    await expect(delayContainer).toBeHidden()

    // Enable auto-collapse via UI - click on the visible switch label (parent of hidden checkbox)
    const switchLabel = popupPage.locator("#autoCollapseToggle").locator("..")
    await switchLabel.click()
    await popupPage.waitForTimeout(200)

    // Delay container should now be visible
    await expect(delayContainer).toBeVisible()

    // Delay input should exist
    const delayInput = popupPage.locator("#collapseDelayInput")
    await expect(delayInput).toBeVisible()

    // Help text should be visible
    const helpText = popupPage.locator("#collapseHelp")
    await expect(helpText).toBeVisible()
  })
})
