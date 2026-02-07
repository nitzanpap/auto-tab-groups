/**
 * Storage utilities using WXT's storage API
 * Provides type-safe access to browser.storage.local
 */

import { storage } from "wxt/utils/storage"
import type {
  AiProvider,
  CustomRulesMapping,
  GroupByMode,
  GroupColorMapping,
  RuleMatchingMode,
  StorageSchema,
  TabGroupColor
} from "../types"
import { DEFAULT_STATE } from "../types/storage"

/**
 * Storage items with default values
 */
export const autoGroupingEnabled = storage.defineItem<boolean>("local:autoGroupingEnabled", {
  fallback: DEFAULT_STATE.autoGroupingEnabled
})

export const groupNewTabs = storage.defineItem<boolean>("local:groupNewTabs", {
  fallback: DEFAULT_STATE.groupNewTabs
})

export const groupByMode = storage.defineItem<GroupByMode>("local:groupByMode", {
  fallback: DEFAULT_STATE.groupByMode
})

export const customRules = storage.defineItem<CustomRulesMapping>("local:customRules", {
  fallback: DEFAULT_STATE.customRules
})

export const ruleMatchingMode = storage.defineItem<RuleMatchingMode>("local:ruleMatchingMode", {
  fallback: DEFAULT_STATE.ruleMatchingMode
})

export const groupColorMapping = storage.defineItem<GroupColorMapping>("local:groupColorMapping", {
  fallback: DEFAULT_STATE.groupColorMapping
})

export const minimumTabsForGroup = storage.defineItem<number>("local:minimumTabsForGroup", {
  fallback: DEFAULT_STATE.minimumTabsForGroup
})

export const autoCollapseEnabled = storage.defineItem<boolean>("local:autoCollapseEnabled", {
  fallback: DEFAULT_STATE.autoCollapseEnabled
})

export const autoCollapseDelayMs = storage.defineItem<number>("local:autoCollapseDelayMs", {
  fallback: DEFAULT_STATE.autoCollapseDelayMs
})

export const aiEnabled = storage.defineItem<boolean>("local:aiEnabled", {
  fallback: DEFAULT_STATE.aiEnabled
})

export const aiProvider = storage.defineItem<AiProvider>("local:aiProvider", {
  fallback: DEFAULT_STATE.aiProvider
})

export const aiModelId = storage.defineItem<string>("local:aiModelId", {
  fallback: DEFAULT_STATE.aiModelId
})

export const aiExternalApiKey = storage.defineItem<string>("local:aiExternalApiKey", {
  fallback: DEFAULT_STATE.aiExternalApiKey
})

export const aiExternalApiEndpoint = storage.defineItem<string>("local:aiExternalApiEndpoint", {
  fallback: DEFAULT_STATE.aiExternalApiEndpoint
})

/**
 * Load all storage values at once
 */
export async function loadAllStorage(): Promise<StorageSchema> {
  const [
    autoGroupingEnabledValue,
    groupNewTabsValue,
    groupByModeValue,
    customRulesValue,
    ruleMatchingModeValue,
    groupColorMappingValue,
    minimumTabsForGroupValue,
    autoCollapseEnabledValue,
    autoCollapseDelayMsValue,
    aiEnabledValue,
    aiProviderValue,
    aiModelIdValue,
    aiExternalApiKeyValue,
    aiExternalApiEndpointValue
  ] = await Promise.all([
    autoGroupingEnabled.getValue(),
    groupNewTabs.getValue(),
    groupByMode.getValue(),
    customRules.getValue(),
    ruleMatchingMode.getValue(),
    groupColorMapping.getValue(),
    minimumTabsForGroup.getValue(),
    autoCollapseEnabled.getValue(),
    autoCollapseDelayMs.getValue(),
    aiEnabled.getValue(),
    aiProvider.getValue(),
    aiModelId.getValue(),
    aiExternalApiKey.getValue(),
    aiExternalApiEndpoint.getValue()
  ])

  return {
    autoGroupingEnabled: autoGroupingEnabledValue,
    groupNewTabs: groupNewTabsValue,
    groupByMode: groupByModeValue,
    customRules: customRulesValue,
    ruleMatchingMode: ruleMatchingModeValue,
    groupColorMapping: groupColorMappingValue,
    minimumTabsForGroup: minimumTabsForGroupValue,
    autoCollapseEnabled: autoCollapseEnabledValue,
    autoCollapseDelayMs: autoCollapseDelayMsValue,
    aiEnabled: aiEnabledValue,
    aiProvider: aiProviderValue,
    aiModelId: aiModelIdValue,
    aiExternalApiKey: aiExternalApiKeyValue,
    aiExternalApiEndpoint: aiExternalApiEndpointValue
  }
}

/**
 * Save all storage values at once
 */
export async function saveAllStorage(data: Partial<StorageSchema>): Promise<void> {
  const promises: Promise<void>[] = []

  if (data.autoGroupingEnabled !== undefined) {
    promises.push(autoGroupingEnabled.setValue(data.autoGroupingEnabled))
  }
  if (data.groupNewTabs !== undefined) {
    promises.push(groupNewTabs.setValue(data.groupNewTabs))
  }
  if (data.groupByMode !== undefined) {
    promises.push(groupByMode.setValue(data.groupByMode))
  }
  if (data.customRules !== undefined) {
    promises.push(customRules.setValue(data.customRules))
  }
  if (data.ruleMatchingMode !== undefined) {
    promises.push(ruleMatchingMode.setValue(data.ruleMatchingMode))
  }
  if (data.groupColorMapping !== undefined) {
    promises.push(groupColorMapping.setValue(data.groupColorMapping))
  }
  if (data.minimumTabsForGroup !== undefined) {
    promises.push(minimumTabsForGroup.setValue(data.minimumTabsForGroup))
  }
  if (data.autoCollapseEnabled !== undefined) {
    promises.push(autoCollapseEnabled.setValue(data.autoCollapseEnabled))
  }
  if (data.autoCollapseDelayMs !== undefined) {
    promises.push(autoCollapseDelayMs.setValue(data.autoCollapseDelayMs))
  }
  if (data.aiEnabled !== undefined) {
    promises.push(aiEnabled.setValue(data.aiEnabled))
  }
  if (data.aiProvider !== undefined) {
    promises.push(aiProvider.setValue(data.aiProvider))
  }
  if (data.aiModelId !== undefined) {
    promises.push(aiModelId.setValue(data.aiModelId))
  }
  if (data.aiExternalApiKey !== undefined) {
    promises.push(aiExternalApiKey.setValue(data.aiExternalApiKey))
  }
  if (data.aiExternalApiEndpoint !== undefined) {
    promises.push(aiExternalApiEndpoint.setValue(data.aiExternalApiEndpoint))
  }

  await Promise.all(promises)
}

/**
 * Get a specific group's saved color
 */
export async function getGroupColor(groupTitle: string): Promise<string | null> {
  const mapping = await groupColorMapping.getValue()
  return mapping[groupTitle] || null
}

/**
 * Update a specific group's color
 */
export async function updateGroupColor(groupTitle: string, color: TabGroupColor): Promise<void> {
  const mapping = await groupColorMapping.getValue()
  const updatedMapping = { ...mapping, [groupTitle]: color }
  await groupColorMapping.setValue(updatedMapping)
}

/**
 * Clear a specific group's saved color
 */
export async function clearGroupColor(groupTitle: string): Promise<void> {
  const mapping = await groupColorMapping.getValue()
  const { [groupTitle]: _, ...rest } = mapping
  await groupColorMapping.setValue(rest)
}
