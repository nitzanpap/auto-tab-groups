/**
 * Storage utilities using WXT's storage API
 * Provides type-safe access to browser.storage.local
 */

import { storage } from "wxt/utils/storage";
import type {
  StorageSchema,
  CustomRulesMapping,
  GroupColorMapping,
  GroupByMode,
  RuleMatchingMode,
  TabGroupColor,
} from "../types";
import { DEFAULT_STATE } from "../types/storage";

/**
 * Storage items with default values
 */
export const autoGroupingEnabled = storage.defineItem<boolean>(
  "local:autoGroupingEnabled",
  { fallback: DEFAULT_STATE.autoGroupingEnabled },
);

export const groupNewTabs = storage.defineItem<boolean>("local:groupNewTabs", {
  fallback: DEFAULT_STATE.groupNewTabs,
});

export const groupByMode = storage.defineItem<GroupByMode>(
  "local:groupByMode",
  { fallback: DEFAULT_STATE.groupByMode },
);

export const customRules = storage.defineItem<CustomRulesMapping>(
  "local:customRules",
  { fallback: DEFAULT_STATE.customRules },
);

export const ruleMatchingMode = storage.defineItem<RuleMatchingMode>(
  "local:ruleMatchingMode",
  { fallback: DEFAULT_STATE.ruleMatchingMode },
);

export const groupColorMapping = storage.defineItem<GroupColorMapping>(
  "local:groupColorMapping",
  { fallback: DEFAULT_STATE.groupColorMapping },
);

export const minimumTabsForGroup = storage.defineItem<number>(
  "local:minimumTabsForGroup",
  { fallback: DEFAULT_STATE.minimumTabsForGroup },
);

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
  ] = await Promise.all([
    autoGroupingEnabled.getValue(),
    groupNewTabs.getValue(),
    groupByMode.getValue(),
    customRules.getValue(),
    ruleMatchingMode.getValue(),
    groupColorMapping.getValue(),
    minimumTabsForGroup.getValue(),
  ]);

  return {
    autoGroupingEnabled: autoGroupingEnabledValue,
    groupNewTabs: groupNewTabsValue,
    groupByMode: groupByModeValue,
    customRules: customRulesValue,
    ruleMatchingMode: ruleMatchingModeValue,
    groupColorMapping: groupColorMappingValue,
    minimumTabsForGroup: minimumTabsForGroupValue,
  };
}

/**
 * Save all storage values at once
 */
export async function saveAllStorage(
  data: Partial<StorageSchema>,
): Promise<void> {
  const promises: Promise<void>[] = [];

  if (data.autoGroupingEnabled !== undefined) {
    promises.push(autoGroupingEnabled.setValue(data.autoGroupingEnabled));
  }
  if (data.groupNewTabs !== undefined) {
    promises.push(groupNewTabs.setValue(data.groupNewTabs));
  }
  if (data.groupByMode !== undefined) {
    promises.push(groupByMode.setValue(data.groupByMode));
  }
  if (data.customRules !== undefined) {
    promises.push(customRules.setValue(data.customRules));
  }
  if (data.ruleMatchingMode !== undefined) {
    promises.push(ruleMatchingMode.setValue(data.ruleMatchingMode));
  }
  if (data.groupColorMapping !== undefined) {
    promises.push(groupColorMapping.setValue(data.groupColorMapping));
  }
  if (data.minimumTabsForGroup !== undefined) {
    promises.push(minimumTabsForGroup.setValue(data.minimumTabsForGroup));
  }

  await Promise.all(promises);
}

/**
 * Get a specific group's saved color
 */
export async function getGroupColor(
  groupTitle: string,
): Promise<string | null> {
  const mapping = await groupColorMapping.getValue();
  return mapping[groupTitle] || null;
}

/**
 * Update a specific group's color
 */
export async function updateGroupColor(
  groupTitle: string,
  color: TabGroupColor,
): Promise<void> {
  const mapping = await groupColorMapping.getValue();
  const updatedMapping = { ...mapping, [groupTitle]: color };
  await groupColorMapping.setValue(updatedMapping);
}

/**
 * Clear a specific group's saved color
 */
export async function clearGroupColor(groupTitle: string): Promise<void> {
  const mapping = await groupColorMapping.getValue();
  const { [groupTitle]: _, ...rest } = mapping;
  await groupColorMapping.setValue(rest);
}
