import { expect, test } from "@playwright/test"
import {
  addCustomRule,
  getCustomRules,
  getExtensionId,
  launchExtensionContext,
  openPopup
} from "./helpers/extension-helpers"

for (const surface of ["popup", "sidebar"]) {
  test(`${surface}: delete confirmation can cancel and delete without browser dialogs`, async () => {
    const context = await launchExtensionContext()
    try {
      const id = await getExtensionId(context)
      const page = await openPopup(context, id)
      const ruleId = await addCustomRule(page, { name: "Removal test", domains: ["example.com"] })
      await page.goto(`chrome-extension://${id}/${surface}.html`)
      // Reproduce environments where window.confirm is suppressed.
      await page.evaluate(() => {
        window.confirm = () => false
      })
      await page.locator(".rules-toggle").click()
      const remove = page.locator(`.delete[data-rule-id="${ruleId}"]`)
      await remove.click()
      const dialog = page.getByRole("dialog")
      await expect(dialog).toBeVisible()
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
      expect((await getCustomRules(page))[ruleId!]).toBeDefined()
      await remove.click()
      await page.keyboard.press("Escape")
      await expect(dialog).toHaveCount(0)
      expect((await getCustomRules(page))[ruleId!]).toBeDefined()
      await remove.click()
      await dialog.getByRole("button", { name: "Delete", exact: true }).click()
      await expect(remove).toHaveCount(0)
      await page.reload()
      expect(await getCustomRules(page)).toEqual({})
      expect(await page.evaluate(() => chrome.storage.local.get("customRules"))).toEqual({
        customRules: {}
      })
    } finally {
      await context.close()
    }
  })
}

test("empty import only clears rules in replace mode", async () => {
  const context = await launchExtensionContext()
  try {
    const id = await getExtensionId(context)
    const page = await openPopup(context, id)
    await addCustomRule(page, { name: "Removal test", domains: ["example.com"] })
    await page.goto(`chrome-extension://${id}/import-rules.html`)
    await page.locator("#fileInput").setInputFiles({
      name: "empty.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"rules":{}}')
    })
    await expect(page.locator("#importButton")).toBeDisabled()
    await page.locator('input[value="replace"]').check()
    await expect(page.locator("#importButton")).toBeEnabled()
    await page.locator('input[value="merge"]').check()
    await expect(page.locator("#importButton")).toBeDisabled()
    await page.locator('input[value="replace"]').check()
    await page.locator("#importButton").click()
    await expect(page.locator("#resultMessage")).toContainText("Successfully imported 0 rules")
    expect(await getCustomRules(page)).toEqual({})
    expect(await page.evaluate(() => chrome.storage.local.get("customRules"))).toEqual({
      customRules: {}
    })
  } finally {
    await context.close()
  }
})
