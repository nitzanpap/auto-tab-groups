/**
 * E2E Tests: Sidebar
 *
 * The sidebar is a near-copy of the popup — same element ids, same wiring,
 * duplicated in a second file. Every test here targets that duplication: a
 * control added to one and forgotten in the other, or wired up in the markup
 * but never connected to the background.
 */

import { type BrowserContext, expect, type Page, test } from "@playwright/test"
import {
  closeTestTabs,
  createTab,
  disableAutoGroup,
  getExtensionId,
  getTabGroups,
  launchExtensionContext,
  openPopup,
  openSidebar,
  sendMessage,
  setGroupByMode,
  setMinimumTabs,
  TEST_URLS,
  ungroupAllTabs,
  waitForGroup
} from "./helpers/extension-helpers"

let context: BrowserContext
let extensionId: string
let popupPage: Page
let sidebarPage: Page

/**
 * Controls that are deliberately not in both surfaces. Empty today — if you
 * add a sidebar-only or popup-only control, list it here so the divergence is
 * a decision rather than an accident.
 */
const KNOWN_DIFFERENCES = new Set<string>([])

async function elementIds(page: Page): Promise<string[]> {
  return await page.evaluate(() =>
    Array.from(document.querySelectorAll("[id]"))
      .map(element => element.id)
      .sort()
  )
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
  await setMinimumTabs(popupPage, 1)
  await setGroupByMode(popupPage, "domain")
  sidebarPage = await openSidebar(context, extensionId)
})

test.afterEach(async () => {
  if (sidebarPage && !sidebarPage.isClosed()) await sidebarPage.close()
  if (popupPage && !popupPage.isClosed()) {
    await disableAutoGroup(popupPage)
    await ungroupAllTabs(popupPage)
    await popupPage.close()
  }
  await closeTestTabs(context)
})

test.describe("Sidebar", () => {
  test("exposes the same controls as the popup", async () => {
    const [popupIds, sidebarIds] = await Promise.all([
      elementIds(popupPage),
      elementIds(sidebarPage)
    ])

    const missingFromSidebar = popupIds.filter(
      id => !sidebarIds.includes(id) && !KNOWN_DIFFERENCES.has(id)
    )
    const missingFromPopup = sidebarIds.filter(
      id => !popupIds.includes(id) && !KNOWN_DIFFERENCES.has(id)
    )

    expect(missingFromSidebar).toEqual([])
    expect(missingFromPopup).toEqual([])
  })

  test("auto-group toggle round-trips through the background", async () => {
    const toggle = sidebarPage.locator("#autoGroupToggle")

    // The sidebar fills its toggles asynchronously, so wait for it to agree
    // with the background before touching anything
    await expect(toggle).not.toBeChecked()

    await toggle.locator("xpath=ancestor::label").click()
    await expect(toggle).toBeChecked()

    const state = (await sendMessage(popupPage, "getAutoGroupState")) as { enabled: boolean }
    expect(state.enabled).toBe(true)
  })

  test("groups and ungroups real tabs from its buttons", async () => {
    await createTab(context, TEST_URLS.domain1)

    await sidebarPage.locator("#group").click()
    await waitForGroup(popupPage, "Example")

    await sidebarPage.locator("#ungroup").click()
    await expect(async () => {
      expect(await getTabGroups(popupPage)).toEqual([])
    }).toPass()
  })

  test("System group toggle disables the dependent new-empty-tabs toggle", async () => {
    const systemToggle = sidebarPage.locator("#systemGroupToggle")
    const newTabsToggle = sidebarPage.locator("#groupNewTabsToggle")

    await expect(systemToggle).toBeChecked()
    await expect(newTabsToggle).toBeEnabled()

    await systemToggle.locator("xpath=ancestor::label").click()

    await expect(systemToggle).not.toBeChecked()
    await expect(newTabsToggle).toBeDisabled()

    // and the background actually heard about it
    const state = (await sendMessage(popupPage, "getSystemGroupEnabled")) as { enabled: boolean }
    expect(state.enabled).toBe(false)

    await sendMessage(popupPage, "toggleSystemGroup", { enabled: true })
  })

  test("lists excluded groups and removes one", async () => {
    await sendMessage(popupPage, "addProtectedGroup", { title: "My Reading List" })

    const sidebar = await openSidebar(context, extensionId)
    const chip = sidebar.locator(".protected-group-chip")
    await expect(chip).toHaveCount(1)
    await expect(chip).toContainText("My Reading List")

    await chip.locator("button").click()
    await expect(sidebar.locator(".protected-group-chip")).toHaveCount(0)

    const remaining = (await sendMessage(popupPage, "getProtectedGroups")) as { titles: string[] }
    expect(remaining.titles).toEqual([])

    await sidebar.close()
  })

  test("keeps the minimum tabs input in sync with the background", async () => {
    await setMinimumTabs(popupPage, 3)

    const sidebar = await openSidebar(context, extensionId)
    await expect(sidebar.locator("#minimumTabsInput")).toHaveValue("3")

    await sidebar.close()
    await setMinimumTabs(popupPage, 1)
  })
})
