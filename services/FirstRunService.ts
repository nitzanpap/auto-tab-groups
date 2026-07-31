/**
 * First-run setup.
 *
 * Everything here runs once, before the extension has ever touched the
 * browser's tab groups.
 */

import { protectedGroupTitles } from "../utils/storage"

/**
 * Protects the tab groups that already exist when the extension first runs.
 *
 * A group present before the extension has ever run cannot have been created
 * by it — that is a fact, not a heuristic, and it is the one moment we can
 * safely say a group belongs to the user. Without this, the startup
 * groupAllTabs() dissolves someone's manual organization seconds after
 * install, before they have touched a single setting.
 *
 * An empty storage.local is what identifies a first run: an update always
 * leaves keys behind. This must therefore run before anything writes to
 * storage, which also means it can only ever fire once.
 *
 * @returns the titles that were protected, empty when this was not a first run
 */
export async function seedProtectedGroupsOnFirstRun(): Promise<string[]> {
  try {
    const existingStorage = await browser.storage.local.get(null)
    if (Object.keys(existingStorage).length > 0) return []

    if (!browser.tabGroups) return []

    const groups = await browser.tabGroups.query({})
    const titles = [...new Set(groups.map(group => group.title).filter(Boolean))] as string[]
    if (titles.length === 0) return []

    await protectedGroupTitles.setValue(titles)
    console.log(
      `[FirstRunService] First run — protecting ${titles.length} pre-existing group(s):`,
      titles
    )
    return titles
  } catch (error) {
    // Never block startup over this
    console.error("[FirstRunService] Failed to seed protected groups:", error)
    return []
  }
}
