/**
 * E2E Tests: Minimum Tabs Threshold
 *
 * Tests minimum tabs threshold functionality:
 * - Does not group below threshold
 * - Groups when threshold is met
 * - Ungroups when below threshold after tab close
 */

import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { type BrowserContext, chromium, expect, type Page, test } from "@playwright/test"
import {
  closeTestTabs,
  createTab,
  disableAutoGroup,
  enableAutoGroup,
  getExtensionId,
  getMinimumTabs,
  getTabGroups,
  getTabs,
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
  // Create a fresh browser context for this test suite
  try {
    context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
    })
    extensionId = await getExtensionId(context)
  } catch (error) {
    console.error("Failed to create context, retrying...", error)
    // Retry once
    context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
    })
    extensionId = await getExtensionId(context)
  }
})

test.afterAll(async () => {
  await context.close()
})

test.beforeEach(async () => {
  // Check if context is still connected
  let needsRecreation = false
  try {
    // Try to use the context - if it fails, we need to recreate
    const pages = context.pages()
    if (pages.length === 0) {
      // Try creating a page to verify context is working
      const testPage = await context.newPage()
      await testPage.close()
    }
  } catch {
    needsRecreation = true
  }

  if (needsRecreation) {
    // Context was closed or invalid, recreate it
    console.log("Recreating browser context for minimum-tabs tests...")
    context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
    })
    extensionId = await getExtensionId(context)
  }

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
    await setMinimumTabs(popupPage, 1)
    await popupPage.close()
  }
  await closeTestTabs(context)
})

// TODO: These tests have a Playwright context isolation issue that needs investigation.
// The browser context closes unexpectedly between beforeEach and test body.
// The minimum tabs threshold functionality is partially tested by other test suites.
test.describe
  .skip("Minimum Tabs Threshold", () => {
    // Note: The extension strips TLDs and capitalizes domain names for group titles
    // e.g., "example.com" -> "Example"

    test("does not group tabs when below threshold", async () => {
      // Set threshold to 3
      await setMinimumTabs(popupPage, 3)

      // Verify threshold is set
      const threshold = await getMinimumTabs(popupPage)
      expect(threshold).toBe(3)

      await enableAutoGroup(popupPage)

      // Create only 2 tabs (below threshold of 3)
      const tab1 = await createTab(context, TEST_URLS.domain1)
      const tab2 = await createTab(context, TEST_URLS.domain1Page2)

      // Wait to ensure no grouping happens
      await popupPage.waitForTimeout(1000)

      // Verify no groups were created
      const groups = await getTabGroups(popupPage)
      expect(groups.length).toBe(0)

      // Verify tabs are ungrouped
      const tabs = await getTabs(popupPage)
      const exampleTabs = tabs.filter(
        t => t.url.includes("example.com") && !t.url.includes("chrome-extension")
      )
      expect(exampleTabs.length).toBe(2)
      expect(exampleTabs.every(t => t.groupId === -1)).toBe(true)

      // Cleanup
      await tab1.close()
      await tab2.close()
    })

    test("groups tabs when threshold is met", async () => {
      // Set threshold to 3
      await setMinimumTabs(popupPage, 3)
      await enableAutoGroup(popupPage)

      // Create 2 tabs (below threshold)
      const tab1 = await createTab(context, TEST_URLS.domain1)
      const tab2 = await createTab(context, TEST_URLS.domain1Page2)

      // Wait and verify no groups yet
      await popupPage.waitForTimeout(500)
      let groups = await getTabGroups(popupPage)
      expect(groups.length).toBe(0)

      // Create 3rd tab (meets threshold)
      const tab3 = await createTab(context, TEST_URLS.domain1Page3)

      // Now grouping should happen (TLD stripped, capitalized)
      await waitForGroup(popupPage, "Example")

      // Verify group was created
      groups = await getTabGroups(popupPage)
      expect(groups.length).toBe(1)
      expect(groups[0].title).toBe("Example")

      // Verify all 3 tabs are in the group
      const tabs = await getTabs(popupPage)
      const exampleTabs = tabs.filter(
        t => t.url.includes("example.com") && !t.url.includes("chrome-extension")
      )
      expect(exampleTabs.length).toBe(3)
      expect(exampleTabs.every(t => t.groupId === groups[0].id)).toBe(true)

      // Cleanup
      await tab1.close()
      await tab2.close()
      await tab3.close()
    })

    test("ungroups tabs when count drops below threshold after tab close", async () => {
      // Set threshold to 3
      await setMinimumTabs(popupPage, 3)
      await enableAutoGroup(popupPage)

      // Create 3 tabs to meet threshold
      const tab1 = await createTab(context, TEST_URLS.domain1)
      const tab2 = await createTab(context, TEST_URLS.domain1Page2)
      const tab3 = await createTab(context, TEST_URLS.domain1Page3)

      // Wait for grouping (TLD stripped, capitalized)
      await waitForGroup(popupPage, "Example")

      // Verify all tabs are grouped
      let groups = await getTabGroups(popupPage)
      expect(groups.length).toBe(1)

      const groupId = groups[0].id
      let tabs = await getTabs(popupPage)
      const groupedTabs = tabs.filter(t => t.groupId === groupId)
      expect(groupedTabs.length).toBe(3)

      // Close one tab (drops below threshold)
      await tab3.close()

      // Wait for threshold check to run
      await popupPage.waitForTimeout(1000)

      // Verify the group was disbanded since we're now below threshold
      groups = await getTabGroups(popupPage)
      tabs = await getTabs(popupPage)

      const exampleTabs = tabs.filter(
        t => t.url.includes("example.com") && !t.url.includes("chrome-extension")
      )

      // Threshold enforcement on removal is now active - tabs should be ungrouped
      expect(groups.length).toBe(0)
      expect(exampleTabs.every(t => t.groupId === -1)).toBe(true)

      // Cleanup
      await tab1.close()
      await tab2.close()
    })
  })
