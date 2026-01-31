/**
 * E2E Tests: Tab Grouping by Domain
 *
 * Tests core tab grouping functionality:
 * - Grouping tabs from same domain
 * - Separating tabs from different domains
 * - ccSLD domain extraction
 * - Pinned tab handling
 * - Subdomain mode
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
  getTabGroups,
  getTabs,
  openPopup,
  pinTab,
  setGroupByMode,
  setMinimumTabs,
  TEST_URLS,
  ungroupAllTabs,
  unpinTab,
  waitForGroup,
  waitForTabInGroup
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
  // Start each test with clean state
  await closeTestTabs(context)
  popupPage = await openPopup(context, extensionId)
  await disableAutoGroup(popupPage)
  await ungroupAllTabs(popupPage)
  await setMinimumTabs(popupPage, 1)
  await setGroupByMode(popupPage, "domain")
})

test.afterEach(async () => {
  // Clean up after each test
  if (popupPage && !popupPage.isClosed()) {
    await disableAutoGroup(popupPage)
    await ungroupAllTabs(popupPage)
    await popupPage.close()
  }
  await closeTestTabs(context)
})

test.describe("Tab Grouping by Domain", () => {
  // Note: The extension strips TLDs and capitalizes domain names for group titles
  // e.g., "example.com" -> "Example", "httpbin.org" -> "Httpbin"

  test("groups tabs from same domain into one group", async () => {
    // Enable auto-grouping
    await enableAutoGroup(popupPage)

    // Create 3 tabs to the same domain
    const tab1 = await createTab(context, TEST_URLS.domain1)
    const tab2 = await createTab(context, TEST_URLS.domain1Page2)
    const tab3 = await createTab(context, TEST_URLS.domain1Page3)

    // Wait for all tabs to be grouped under "Example" (TLD stripped, capitalized)
    await waitForTabInGroup(popupPage, "example.com", "Example")

    // Verify there's only one group
    const groups = await getTabGroups(popupPage)
    const exampleGroup = groups.find(g => g.title === "Example")
    expect(exampleGroup).toBeDefined()

    // Verify all tabs are in the same group
    const tabs = await getTabs(popupPage)
    const exampleTabs = tabs.filter(
      t => t.url.includes("example.com") && !t.url.includes("chrome-extension")
    )
    expect(exampleTabs.length).toBe(3)
    expect(exampleTabs.every(t => t.groupId === exampleGroup?.id)).toBe(true)

    // Cleanup
    await tab1.close()
    await tab2.close()
    await tab3.close()
  })

  test("separates tabs from different domains into different groups", async () => {
    await enableAutoGroup(popupPage)

    // Create tabs to different domains
    const tab1 = await createTab(context, TEST_URLS.domain1)
    const tab2 = await createTab(context, TEST_URLS.domain2)

    // Wait for groups to be created (TLDs stripped, capitalized)
    await waitForGroup(popupPage, "Example")
    await waitForGroup(popupPage, "Httpbin")

    // Verify expected groups exist (may have additional system groups)
    const groups = await getTabGroups(popupPage)
    expect(groups.some(g => g.title === "Example")).toBe(true)
    expect(groups.some(g => g.title === "Httpbin")).toBe(true)

    // Verify tabs are in separate groups
    const tabs = await getTabs(popupPage)
    const exampleTab = tabs.find(t => t.url.includes("example.com"))
    const httpbinTab = tabs.find(t => t.url.includes("httpbin.org"))

    expect(exampleTab).toBeDefined()
    expect(httpbinTab).toBeDefined()
    expect(exampleTab?.groupId).not.toBe(httpbinTab?.groupId)
    expect(exampleTab?.groupId).not.toBe(-1)
    expect(httpbinTab?.groupId).not.toBe(-1)

    // Cleanup
    await tab1.close()
    await tab2.close()
  })

  test("extracts domain correctly with ccSLD (e.g., .co.uk)", async () => {
    await enableAutoGroup(popupPage)

    // Create a tab to a ccSLD domain
    const tab = await createTab(context, TEST_URLS.ccSLD)

    // Wait for the group - should be "Bbc" (ccSLD .co.uk stripped correctly, capitalized)
    await waitForGroup(popupPage, "Bbc")

    // Verify the group title
    const groups = await getTabGroups(popupPage)
    const bbcGroup = groups.find(g => g.title === "Bbc")
    expect(bbcGroup).toBeDefined()

    // Verify no "co" or "co.uk" group was created
    const coGroup = groups.find(g => g.title === "co" || g.title === "co.uk")
    expect(coGroup).toBeUndefined()

    // Cleanup
    await tab.close()
  })

  test("does not group pinned tabs", async () => {
    await enableAutoGroup(popupPage)

    // Create a tab and wait for it to be grouped
    const tab = await createTab(context, TEST_URLS.domain1)
    await waitForTabInGroup(popupPage, "example.com", "Example")

    // Pin the tab
    await pinTab(popupPage, "example.com")

    // Wait a moment for the pin action to be processed
    await popupPage.waitForTimeout(500)

    // Verify the tab is still grouped (pinning doesn't auto-ungroup)
    // But if we ungroup and regroup, pinned tabs shouldn't be grouped
    await ungroupAllTabs(popupPage)

    // Trigger manual grouping
    await popupPage.locator("#group").click()
    await popupPage.waitForTimeout(500)

    // Verify the pinned tab is NOT grouped
    const tabs = await getTabs(popupPage)
    const pinnedTab = tabs.find(t => t.url.includes("example.com") && t.pinned)
    expect(pinnedTab).toBeDefined()
    expect(pinnedTab?.groupId).toBe(-1)

    // Unpin for cleanup
    await unpinTab(popupPage, "example.com")
    await tab.close()
  })

  test("handles subdomain mode - separates subdomains into different groups", async () => {
    // Set to subdomain mode
    await setGroupByMode(popupPage, "subdomain")
    await enableAutoGroup(popupPage)

    // Create tabs to different subdomains of the same domain
    const tab1 = await createTab(context, TEST_URLS.subDomain1) // api.github.com
    const tab2 = await createTab(context, TEST_URLS.subDomain2) // docs.github.com

    // Wait for groups to be created - in subdomain mode, full subdomain is used
    // Group titles strip TLD and capitalize: "api.github.com" -> "Api.github", "docs.github.com" -> "Docs.github"
    await waitForGroup(popupPage, "Api.github")
    await waitForGroup(popupPage, "Docs.github")

    // Verify there are 2 separate groups
    const groups = await getTabGroups(popupPage)
    const apiGroup = groups.find(g => g.title === "Api.github")
    const docsGroup = groups.find(g => g.title === "Docs.github")

    expect(apiGroup).toBeDefined()
    expect(docsGroup).toBeDefined()
    expect(apiGroup?.id).not.toBe(docsGroup?.id)

    // Cleanup
    await tab1.close()
    await tab2.close()
    await setGroupByMode(popupPage, "domain")
  })
})
