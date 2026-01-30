/**
 * E2E Tests: Custom Rules
 *
 * Tests custom rule functionality:
 * - Rule groups matching tabs under rule name
 * - Rule takes priority over domain grouping
 * - Disabled rule does not apply
 * - Delete rule regroups tabs by domain
 */

import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { type BrowserContext, chromium, expect, type Page, test } from "@playwright/test"
import {
  addCustomRule,
  closeTestTabs,
  createTab,
  deleteCustomRule,
  disableAutoGroup,
  enableAutoGroup,
  getCustomRules,
  getExtensionId,
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

  // Clean up any existing rules
  const existingRules = await getCustomRules(popupPage)
  for (const ruleId of Object.keys(existingRules)) {
    await deleteCustomRule(popupPage, ruleId)
  }
})

test.afterEach(async () => {
  if (popupPage && !popupPage.isClosed()) {
    await disableAutoGroup(popupPage)
    await ungroupAllTabs(popupPage)

    // Clean up rules
    const rules = await getCustomRules(popupPage)
    for (const ruleId of Object.keys(rules)) {
      await deleteCustomRule(popupPage, ruleId)
    }

    await popupPage.close()
  }
  await closeTestTabs(context)
})

test.describe("Custom Rules", () => {
  test("rule groups matching tabs under rule name", async () => {
    // Create a rule that groups example.com and httpbin.org under "Test Sites"
    const ruleId = await addCustomRule(popupPage, {
      name: "Test Sites",
      domains: ["example.com", "httpbin.org"],
      color: "blue",
      enabled: true
    })
    expect(ruleId).toBeTruthy()

    // Enable auto-grouping
    await enableAutoGroup(popupPage)

    // Create tabs to both domains
    const tab1 = await createTab(context, TEST_URLS.domain1)
    const tab2 = await createTab(context, TEST_URLS.domain2)

    // Wait for group to be created with the rule name
    await waitForGroup(popupPage, "Test Sites")

    // Verify the rule group exists
    const groups = await getTabGroups(popupPage)
    const ruleGroup = groups.find(g => g.title === "Test Sites")
    expect(ruleGroup).toBeDefined()

    // Verify both tabs are in the rule group (not domain groups)
    const tabs = await getTabs(popupPage)
    const matchingTabs = tabs.filter(
      t =>
        (t.url.includes("example.com") || t.url.includes("httpbin.org")) &&
        !t.url.includes("chrome-extension")
    )
    expect(matchingTabs.length).toBe(2)
    expect(matchingTabs.every(t => t.groupId === ruleGroup?.id)).toBe(true)

    // Verify no separate domain groups were created
    const exampleGroup = groups.find(g => g.title === "example")
    const httpbinGroup = groups.find(g => g.title === "httpbin")
    expect(exampleGroup).toBeUndefined()
    expect(httpbinGroup).toBeUndefined()

    // Cleanup
    await tab1.close()
    await tab2.close()
  })

  test("rule takes priority over domain grouping", async () => {
    // Create a rule for example.com with custom name
    const ruleId = await addCustomRule(popupPage, {
      name: "My Example",
      domains: ["example.com"],
      color: "green",
      enabled: true
    })
    expect(ruleId).toBeTruthy()

    await enableAutoGroup(popupPage)

    // Create a tab to example.com
    const tab = await createTab(context, TEST_URLS.domain1)

    // Should be grouped under rule name, not domain name
    await waitForGroup(popupPage, "My Example")

    // Verify the group is named by rule, not domain
    const groups = await getTabGroups(popupPage)
    const ruleGroup = groups.find(g => g.title === "My Example")
    const domainGroup = groups.find(g => g.title === "example.com")

    expect(ruleGroup).toBeDefined()
    expect(domainGroup).toBeUndefined()

    // Cleanup
    await tab.close()
  })

  test("disabled rule does not apply - tabs grouped by domain instead", async () => {
    // Create a disabled rule
    const ruleId = await addCustomRule(popupPage, {
      name: "Disabled Rule",
      domains: ["example.com"],
      color: "red",
      enabled: false
    })
    expect(ruleId).toBeTruthy()

    await enableAutoGroup(popupPage)

    // Create a tab to example.com
    const tab = await createTab(context, TEST_URLS.domain1)

    // Should be grouped by domain (TLD stripped), not rule (since rule is disabled)
    await waitForGroup(popupPage, "example")

    // Verify the group is named by domain, not the disabled rule
    const groups = await getTabGroups(popupPage)
    const domainGroup = groups.find(g => g.title === "example")
    const ruleGroup = groups.find(g => g.title === "Disabled Rule")

    expect(domainGroup).toBeDefined()
    expect(ruleGroup).toBeUndefined()

    // Cleanup
    await tab.close()
  })

  test("delete rule regroups tabs by domain", async () => {
    // Create a rule
    const ruleId = await addCustomRule(popupPage, {
      name: "Temp Rule",
      domains: ["example.com"],
      color: "purple",
      enabled: true
    })
    expect(ruleId).toBeTruthy()

    await enableAutoGroup(popupPage)

    // Create a tab - should be grouped by rule
    const tab = await createTab(context, TEST_URLS.domain1)
    await waitForGroup(popupPage, "Temp Rule")

    // Verify grouped by rule name
    let groups = await getTabGroups(popupPage)
    expect(groups.some(g => g.title === "Temp Rule")).toBe(true)

    // Delete the rule
    await deleteCustomRule(popupPage, ruleId!)

    // The extension should regroup tabs by domain
    // Wait for the regrouping to happen
    await popupPage.waitForTimeout(1000)

    // Since auto-group is on and rule is deleted, tabs should regroup by domain (TLD stripped)
    await waitForGroup(popupPage, "example")

    // Verify the tab is now grouped by domain
    groups = await getTabGroups(popupPage)
    const domainGroup = groups.find(g => g.title === "example")
    const ruleGroup = groups.find(g => g.title === "Temp Rule")

    expect(domainGroup).toBeDefined()
    expect(ruleGroup).toBeUndefined()

    // Cleanup
    await tab.close()
  })
})
