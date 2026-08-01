/**
 * Keyboard command handling.
 *
 * The manifest declares these commands without a suggested_key, so the browser
 * binds nothing on install: they show up unassigned in the browser's own
 * shortcuts page and stay inert until the user assigns a key. Nothing here runs
 * unless someone deliberately opted in.
 */

import { saveAllStorage } from "../utils/storage"
import { tabGroupService } from "./TabGroupService"
import { tabGroupState } from "./TabGroupState"

/** Command ids, mirrored in wxt.config.ts */
export const COMMANDS = {
  TOGGLE_AUTO_GROUPING: "toggle-auto-grouping",
  GROUP_ALL_TABS: "group-all-tabs",
  UNGROUP_ALL_TABS: "ungroup-all-tabs",
  TOGGLE_COLLAPSE: "toggle-collapse",
  MOVE_TO_GROUP_WINDOW: "move-tab-to-group-window"
} as const

export type CommandId = (typeof COMMANDS)[keyof typeof COMMANDS]

/**
 * Runs the action bound to a keyboard command.
 *
 * Deliberately routed through the same service calls as the popup buttons, so
 * a shortcut and a click can never drift apart.
 *
 * @returns whether the command was recognised
 */
export async function handleCommand(command: string): Promise<boolean> {
  console.log(`[CommandService] Received command: ${command}`)

  switch (command) {
    case COMMANDS.TOGGLE_AUTO_GROUPING: {
      tabGroupState.autoGroupingEnabled = !tabGroupState.autoGroupingEnabled
      await saveAllStorage(tabGroupState.getStorageData())

      if (tabGroupState.autoGroupingEnabled) {
        await tabGroupService.groupAllTabs()
      }
      return true
    }

    case COMMANDS.GROUP_ALL_TABS:
      await tabGroupService.groupAllTabsManually()
      return true

    case COMMANDS.UNGROUP_ALL_TABS:
      await tabGroupService.ungroupAllTabs()
      return true

    case COMMANDS.TOGGLE_COLLAPSE:
      await tabGroupService.toggleAllGroupsCollapse()
      return true

    case COMMANDS.MOVE_TO_GROUP_WINDOW: {
      const [active] = await browser.tabs.query({ active: true, currentWindow: true })
      if (active?.id) {
        await tabGroupService.moveTabToItsGroupWindow(active.id)
      }
      return true
    }

    default:
      // _execute_action and anything the browser adds later are handled by the
      // browser itself, not here
      console.log(`[CommandService] No handler for command: ${command}`)
      return false
  }
}
