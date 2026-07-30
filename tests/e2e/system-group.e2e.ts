/**
 * E2E Tests: System Group Toggle
 *
 * Tests the opt-in setting that removes the "System" group entirely:
 * - System tabs stay ungrouped while the setting is off
 * - Existing System groups are dissolved when the setting is turned off
 * - The dependent "group new empty tabs" toggle follows it in the UI
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
  groupAllTabs,
  openPopup,
  sendMessage,
  setGroupByMode,
  setMinimumTabs,
  TEST_URLS,
  ungroupAllTabs
} from "./helpers/extension-helpers"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const extensionPath = join(__dirname, "../../.output/chrome-mv3")

let context: BrowserContext
let extensionId: string
let popupPage: Page

/** A blank tab resolves to the "system" domain, same as chrome:// pages */
const SYSTEM_TAB_URL = "about:blank"

async function setSystemGroupEnabled(page: Page, enabled: boolean): Promise<void> {
  await sendMessage(page, "toggleSystemGroup", { enabled })
}

async function hasSystemGroup(page: Page): Promise<boolean> {
  const groups = await getTabGroups(page)
  return groups.some(group => group.title === "System")
}

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
  await setSystemGroupEnabled(popupPage, true)
})

test.afterEach(async () => {
  if (popupPage && !popupPage.isClosed()) {
    await disableAutoGroup(popupPage)
    await setSystemGroupEnabled(popupPage, true)
    await ungroupAllTabs(popupPage)
    await popupPage.close()
  }
  await closeTestTabs(context)
})

test.describe("System Group Toggle", () => {
  test("is enabled by default", async () => {
    const result = (await sendMessage(popupPage, "getSystemGroupEnabled")) as { enabled: boolean }
    expect(result.enabled).toBe(true)
    await expect(popupPage.locator("#systemGroupToggle")).toBeChecked()
  })

  test("does not create a System group while disabled", async () => {
    await setSystemGroupEnabled(popupPage, false)
    await enableAutoGroup(popupPage)

    await createTab(context, SYSTEM_TAB_URL)
    await popupPage.waitForTimeout(1000)

    expect(await hasSystemGroup(popupPage)).toBe(false)
  })

  test("does not create a System group from an explicit Group Tabs click", async () => {
    await setSystemGroupEnabled(popupPage, false)

    await createTab(context, SYSTEM_TAB_URL)
    await groupAllTabs(popupPage)
    await popupPage.waitForTimeout(1000)

    expect(await hasSystemGroup(popupPage)).toBe(false)
  })

  test("dissolves an existing System group when turned off", async () => {
    await enableAutoGroup(popupPage)
    await createTab(context, SYSTEM_TAB_URL)
    await popupPage.waitForTimeout(1000)
    expect(await hasSystemGroup(popupPage)).toBe(true)

    await setSystemGroupEnabled(popupPage, false)
    await popupPage.waitForTimeout(1000)

    expect(await hasSystemGroup(popupPage)).toBe(false)
  })

  test("still groups regular tabs while disabled", async () => {
    await setSystemGroupEnabled(popupPage, false)
    await enableAutoGroup(popupPage)

    await createTab(context, TEST_URLS.domain1)
    await popupPage.waitForTimeout(1500)

    const groups = await getTabGroups(popupPage)
    expect(groups.some(group => group.title === "Example")).toBe(true)
  })

  test("disables the dependent new-empty-tabs toggle in the popup", async () => {
    const systemToggle = popupPage.locator("#systemGroupToggle")
    const newTabsToggle = popupPage.locator("#groupNewTabsToggle")

    await expect(newTabsToggle).toBeEnabled()

    // Click the visible label — the checkbox itself is styled away
    await systemToggle.locator("xpath=ancestor::label").click()
    await popupPage.waitForTimeout(500)

    await expect(systemToggle).not.toBeChecked()
    await expect(newTabsToggle).toBeDisabled()
  })
})
