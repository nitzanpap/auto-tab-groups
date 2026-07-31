/**
 * E2E Tests: Rule Editor Title & Save Button
 *
 * The editor's title and save button are mode-specific, but every [data-i18n]
 * element is re-translated once the locale catalog loads. These tests pin the
 * final rendered text for each mode so a translation pass can't quietly
 * overwrite it again.
 */

import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { type BrowserContext, chromium, expect, type Page, test } from "@playwright/test"
import {
  addCustomRule,
  closeTestTabs,
  deleteCustomRule,
  disableAutoGroup,
  getCustomRules,
  getExtensionId,
  openPopup
} from "./helpers/extension-helpers"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const extensionPath = join(__dirname, "../../.output/chrome-mv3")

let context: BrowserContext
let extensionId: string
let popupPage: Page

async function deleteAllRules(page: Page): Promise<void> {
  const rules = await getCustomRules(page)
  for (const ruleId of Object.keys(rules)) {
    await deleteCustomRule(page, ruleId)
  }
}

async function openRuleEditor(query = ""): Promise<Page> {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/rules-modal.html${query}`)
  await page.waitForLoadState("networkidle")
  return page
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
  await deleteAllRules(popupPage)
})

test.afterEach(async () => {
  if (popupPage && !popupPage.isClosed()) {
    await deleteAllRules(popupPage)
    await popupPage.close()
  }
  await closeTestTabs(context)
})

test.describe("Rule editor title", () => {
  test("shows the create title in the default mode", async () => {
    const editor = await openRuleEditor()

    await expect(editor.locator("#modalTitle")).toHaveText("Create Custom Rule")
    await expect(editor.locator("#saveButton")).toHaveText("Save Rule")

    await editor.close()
  })

  test("shows the blacklist title in blacklist mode", async () => {
    const editor = await openRuleEditor("?blacklist=true")

    await expect(editor.locator("#modalTitle")).toHaveText("Add to Blacklist")
    await expect(editor.locator("#saveButton")).toHaveText("Save Rule")

    await editor.close()
  })

  test("shows the edit title when editing a rule", async () => {
    const ruleId = await addCustomRule(popupPage, { name: "Docs", domains: ["docs.google.com"] })
    const editor = await openRuleEditor(`?edit=true&ruleId=${ruleId}`)

    await expect(editor.locator("#modalTitle")).toHaveText("Edit Custom Rule")
    await expect(editor.locator("#saveButton")).toHaveText("Update Rule")

    await editor.close()
  })

  test("shows the blacklist edit title when editing a blacklist rule", async () => {
    const ruleId = await addCustomRule(popupPage, { name: "Blocked", domains: ["blocked.com"] })
    const editor = await openRuleEditor(`?edit=true&ruleId=${ruleId}&blacklist=true`)

    await expect(editor.locator("#modalTitle")).toHaveText("Edit blacklist rule")
    await expect(editor.locator("#saveButton")).toHaveText("Update Rule")

    await editor.close()
  })

  test("shows the from-group title when created from a group", async () => {
    const editor = await openRuleEditor("?fromGroup=true&name=Work&color=blue&domains=example.com")

    await expect(editor.locator("#modalTitle")).toHaveText("Create Rule from Group")
    await expect(editor.locator("#saveButton")).toHaveText("Save Rule")

    await editor.close()
  })

  test("keeps the mode title after the locale catalog loads", async () => {
    // The overwrite this guards against happened once the override catalog
    // resolved, so re-assert with a non-default locale selected.
    await popupPage.evaluate(
      async () =>
        await new Promise(resolve =>
          chrome.runtime.sendMessage({ action: "setUserLocale", locale: "de" }, resolve)
        )
    )

    try {
      const editor = await openRuleEditor("?blacklist=true")
      await editor.waitForTimeout(500)

      await expect(editor.locator("#modalTitle")).toHaveText("Zur Sperrliste hinzufügen")

      await editor.close()
    } finally {
      await popupPage.evaluate(
        async () =>
          await new Promise(resolve =>
            chrome.runtime.sendMessage({ action: "setUserLocale", locale: "auto" }, resolve)
          )
      )
    }
  })
})
