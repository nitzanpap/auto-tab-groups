/**
 * E2E Tests: Catch-All Rules
 *
 * Tests the "*" rule that collects whatever no other rule claimed:
 * - Rules-only mode: everything unmatched lands in the catch-all group
 * - Domain mode: domain grouping wins, the catch-all takes below-threshold tabs
 * - Normal rules and blacklist rules still take priority
 */

import { type BrowserContext, expect, type Page, test } from "@playwright/test"
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
  launchExtensionContext,
  openPopup,
  setGroupByMode,
  setMinimumTabs,
  TEST_URLS,
  ungroupAllTabs,
  waitForGroup
} from "./helpers/extension-helpers"

let context: BrowserContext
let extensionId: string
let popupPage: Page

const CATCH_ALL_GROUP = "Other"

async function deleteAllRules(page: Page): Promise<void> {
  const rules = await getCustomRules(page)
  for (const ruleId of Object.keys(rules)) {
    await deleteCustomRule(page, ruleId)
  }
}

test.beforeAll(async () => {
  context = await launchExtensionContext()
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
  await deleteAllRules(popupPage)
  await setMinimumTabs(popupPage, 1)
  await setGroupByMode(popupPage, "domain")
})

test.afterEach(async () => {
  if (popupPage && !popupPage.isClosed()) {
    await disableAutoGroup(popupPage)
    await ungroupAllTabs(popupPage)
    await deleteAllRules(popupPage)
    await setMinimumTabs(popupPage, 1)
    await popupPage.close()
  }
  await closeTestTabs(context)
})

test.describe("Catch-All Rules - rules-only mode", () => {
  test.beforeEach(async () => {
    await setGroupByMode(popupPage, "rules-only")
  })

  test("collects tabs that no rule matched", async () => {
    await addCustomRule(popupPage, { name: CATCH_ALL_GROUP, domains: ["*"], color: "grey" })
    await enableAutoGroup(popupPage)

    await createTab(context, TEST_URLS.domain1)
    await waitForGroup(popupPage, CATCH_ALL_GROUP)

    const groups = await getTabGroups(popupPage)
    expect(groups.some(group => group.title === CATCH_ALL_GROUP)).toBe(true)
  })

  test("normal rules still win over the catch-all", async () => {
    await addCustomRule(popupPage, { name: CATCH_ALL_GROUP, domains: ["*"], color: "grey" })
    await addCustomRule(popupPage, { name: "Examples", domains: ["example.com"], color: "blue" })
    await enableAutoGroup(popupPage)

    await createTab(context, TEST_URLS.domain1)
    await waitForGroup(popupPage, "Examples")

    const groups = await getTabGroups(popupPage)
    expect(groups.some(group => group.title === "Examples")).toBe(true)
    expect(groups.some(group => group.title === CATCH_ALL_GROUP)).toBe(false)
  })

  test("exclusions carve holes in the catch-all", async () => {
    await addCustomRule(popupPage, {
      name: CATCH_ALL_GROUP,
      domains: ["*", "!example.com"],
      color: "grey"
    })
    await enableAutoGroup(popupPage)

    await createTab(context, TEST_URLS.domain1)
    await createTab(context, TEST_URLS.domain2)
    await waitForGroup(popupPage, CATCH_ALL_GROUP)

    // httpbin lands in the catch-all, example.com is excluded and stays ungrouped
    const groups = await getTabGroups(popupPage)
    const catchAllGroup = groups.find(group => group.title === CATCH_ALL_GROUP)
    expect(catchAllGroup).toBeDefined()

    const tabs = await popupPage.evaluate(async groupId => {
      const result = await chrome.tabs.query({ groupId })
      return result.map(tab => tab.url)
    }, catchAllGroup?.id)

    expect(tabs.some(url => url?.includes("httpbin"))).toBe(true)
    expect(tabs.some(url => url?.includes("example.com"))).toBe(false)
  })
})

test.describe("Catch-All Rules - domain mode", () => {
  test("domain grouping wins over the catch-all", async () => {
    await addCustomRule(popupPage, { name: CATCH_ALL_GROUP, domains: ["*"], color: "grey" })
    await enableAutoGroup(popupPage)

    await createTab(context, TEST_URLS.domain1)
    await waitForGroup(popupPage, "Example")

    const groups = await getTabGroups(popupPage)
    expect(groups.some(group => group.title === "Example")).toBe(true)
    expect(groups.some(group => group.title === CATCH_ALL_GROUP)).toBe(false)
  })

  test("collects tabs below the minimum group size", async () => {
    await setMinimumTabs(popupPage, 2)
    await addCustomRule(popupPage, { name: CATCH_ALL_GROUP, domains: ["*"], color: "grey" })
    await enableAutoGroup(popupPage)

    // A single tab of this domain can't reach the minimum of 2
    await createTab(context, TEST_URLS.domain1)
    await waitForGroup(popupPage, CATCH_ALL_GROUP)

    const groups = await getTabGroups(popupPage)
    expect(groups.some(group => group.title === CATCH_ALL_GROUP)).toBe(true)
    expect(groups.some(group => group.title === "Example")).toBe(false)
  })
})
