/**
 * E2E Tests: Rule Editor Priority & Minimum Tabs Fields
 *
 * Drives the real rule editor form (rules-modal.html) rather than the message
 * API, so the DOM wiring is actually exercised:
 * - Creating a rule persists priority and the per-rule minimum
 * - Editing a rule loads both fields back into the form
 * - Clearing the minimum restores the global setting
 * - Blacklist mode hides the minimum-tabs field
 */

import { type BrowserContext, expect, type Page, test } from "@playwright/test"
import {
  closeTestTabs,
  deleteCustomRule,
  disableAutoGroup,
  getCustomRules,
  getExtensionId,
  launchExtensionContext,
  openPopup,
  ungroupAllTabs
} from "./helpers/extension-helpers"

let context: BrowserContext
let extensionId: string
let popupPage: Page

interface StoredRule {
  id: string
  name: string
  priority?: number
  minimumTabs?: number
}

async function deleteAllRules(page: Page): Promise<void> {
  const rules = await getCustomRules(page)
  for (const ruleId of Object.keys(rules)) {
    await deleteCustomRule(page, ruleId)
  }
}

async function openRuleEditor(query = ""): Promise<Page> {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/rules-modal.html${query}`)
  await page.waitForLoadState("domcontentloaded")
  return page
}

/** Reads rules straight from storage, so it works after the editor closes itself */
async function readRules(): Promise<Record<string, StoredRule>> {
  const rules = await getCustomRules(popupPage)
  return rules as unknown as Record<string, StoredRule>
}

async function findRule(name: string): Promise<StoredRule | undefined> {
  return Object.values(await readRules()).find(rule => rule.name === name)
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
})

test.afterEach(async () => {
  if (popupPage && !popupPage.isClosed()) {
    await deleteAllRules(popupPage)
    await popupPage.close()
  }
  await closeTestTabs(context)
})

test.describe("Rule editor - priority and minimum tabs", () => {
  test("defaults priority to 1 and leaves the minimum empty", async () => {
    const editor = await openRuleEditor()

    await expect(editor.locator("#rulePriority")).toHaveValue("1")
    await expect(editor.locator("#ruleMinimumTabs")).toHaveValue("")

    await editor.close()
  })

  test("saves both fields when creating a rule", async () => {
    const editor = await openRuleEditor()

    await editor.locator("#ruleName").fill("Docs")
    await editor.locator("#rulePatterns").fill("docs.google.com")
    await editor.locator("#rulePriority").fill("7")
    await editor.locator("#ruleMinimumTabs").fill("3")
    await editor.locator("#saveButton").click()
    await popupPage.waitForTimeout(500)

    const rule = await findRule("Docs")
    expect(rule?.priority).toBe(7)
    expect(rule?.minimumTabs).toBe(3)
  })

  test("loads both fields back when editing a rule", async () => {
    const create = await openRuleEditor()
    await create.locator("#ruleName").fill("Docs")
    await create.locator("#rulePatterns").fill("docs.google.com")
    await create.locator("#rulePriority").fill("7")
    await create.locator("#ruleMinimumTabs").fill("3")
    await create.locator("#saveButton").click()
    await popupPage.waitForTimeout(500)

    const rule = await findRule("Docs")
    const editor = await openRuleEditor(`?edit=true&ruleId=${rule?.id}`)

    await expect(editor.locator("#rulePriority")).toHaveValue("7")
    await expect(editor.locator("#ruleMinimumTabs")).toHaveValue("3")

    await editor.close()
  })

  test("clearing the minimum removes the per-rule override", async () => {
    const create = await openRuleEditor()
    await create.locator("#ruleName").fill("Docs")
    await create.locator("#rulePatterns").fill("docs.google.com")
    await create.locator("#ruleMinimumTabs").fill("3")
    await create.locator("#saveButton").click()
    await popupPage.waitForTimeout(500)

    const rule = await findRule("Docs")
    expect(rule?.minimumTabs).toBe(3)

    const editor = await openRuleEditor(`?edit=true&ruleId=${rule?.id}`)
    await editor.locator("#ruleMinimumTabs").fill("")
    await editor.locator("#saveButton").click()
    await popupPage.waitForTimeout(500)

    const updated = await findRule("Docs")
    expect(updated?.minimumTabs).toBeUndefined()
  })

  test("hides the minimum-tabs field for blacklist rules but keeps priority", async () => {
    const editor = await openRuleEditor("?blacklist=true")

    await expect(editor.locator("#minimumTabsField")).toBeHidden()
    await expect(editor.locator("#rulePriority")).toBeVisible()

    await editor.close()
  })
})
