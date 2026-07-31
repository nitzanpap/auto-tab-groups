/**
 * E2E Tests: Keyboard Shortcuts
 *
 * The point of these is the opt-in guarantee: the extension declares commands
 * but suggests no keys, so a fresh install takes none of the user's existing
 * shortcuts and nothing fires until they assign keys themselves.
 */

import { type BrowserContext, expect, type Page, test } from "@playwright/test"
import {
  closeTestTabs,
  getExtensionId,
  launchExtensionContext,
  openPopup,
  openSidebar
} from "./helpers/extension-helpers"

let context: BrowserContext
let extensionId: string
let popupPage: Page

const OWN_COMMANDS = [
  "toggle-auto-grouping",
  "group-all-tabs",
  "ungroup-all-tabs",
  "toggle-collapse"
]

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
})

test.afterEach(async () => {
  if (popupPage && !popupPage.isClosed()) await popupPage.close()
  await closeTestTabs(context)
})

test.describe("Keyboard shortcuts", () => {
  test("registers every command with the browser", async () => {
    const commands = await popupPage.evaluate(async () => await chrome.commands.getAll())
    const names = commands.map(command => command.name)

    for (const command of OWN_COMMANDS) {
      expect(names).toContain(command)
    }
  })

  test("ships no key bindings, so nothing is taken on install", async () => {
    const commands = await popupPage.evaluate(async () => await chrome.commands.getAll())

    // This is the opt-in guarantee. If a suggested_key ever gets added, a fresh
    // install would silently claim that combination from the user.
    const bound = commands.filter(command => command.shortcut && command.shortcut.length > 0)
    expect(bound.map(command => `${command.name}: ${command.shortcut}`)).toEqual([])
  })

  test("describes each command for the browser's shortcut list", async () => {
    const commands = await popupPage.evaluate(async () => await chrome.commands.getAll())

    for (const name of OWN_COMMANDS) {
      const command = commands.find(entry => entry.name === name)
      expect(command?.description).toBeTruthy()
      // A raw __MSG_ placeholder here means the manifest string was never localized
      expect(command?.description).not.toContain("__MSG_")
    }
  })

  test("offers a way into the browser's shortcut settings from the popup", async () => {
    await expect(popupPage.locator("#openShortcutsButton")).toBeAttached()
  })

  test("offers the same from the sidebar", async () => {
    const sidebar = await openSidebar(context, extensionId)

    await expect(sidebar.locator("#openShortcutsButton")).toBeAttached()

    await sidebar.close()
  })
})
