/**
 * Type definitions for browser storage
 */

import type { AiProvider } from "./ai"
import type { CustomRule, TabGroupColor } from "./rules"

/**
 * Group-by mode options
 */
export type GroupByMode = "rules-only" | "domain" | "subdomain"

/**
 * Rule matching mode options
 */
export type RuleMatchingMode = "exact" | "contains" | "regex"

/**
 * Mapping of group titles to their colors
 */
export type GroupColorMapping = Record<string, TabGroupColor>

/**
 * Mapping of rule IDs to CustomRule objects
 */
export type CustomRulesMapping = Record<string, CustomRule>

/**
 * Storage schema - matches browser.storage.local structure
 */
export interface StorageSchema {
  /** Whether automatic tab grouping is enabled */
  autoGroupingEnabled: boolean
  /** Whether to group new empty tabs under "System" */
  groupNewTabs: boolean
  /** How to group tabs: by rules only, domain, or subdomain */
  groupByMode: GroupByMode
  /** Custom rules for grouping specific domains */
  customRules: CustomRulesMapping
  /** How to match rules against URLs */
  ruleMatchingMode: RuleMatchingMode
  /** Saved colors for group titles */
  groupColorMapping: GroupColorMapping
  /** Global minimum tabs required to form a group */
  minimumTabsForGroup: number
  /** Whether auto-collapse is enabled (focus mode) */
  autoCollapseEnabled: boolean
  /** Delay in milliseconds before collapsing (0 = immediate) */
  autoCollapseDelayMs: number
  /** Whether AI features are enabled */
  aiEnabled: boolean
  /** Active AI provider backend */
  aiProvider: AiProvider
  /** Selected AI model ID */
  aiModelId: string
}

/**
 * Default storage state
 */
export const DEFAULT_STATE: StorageSchema = {
  autoGroupingEnabled: true,
  groupNewTabs: true,
  groupByMode: "domain",
  customRules: {},
  ruleMatchingMode: "exact",
  groupColorMapping: {},
  minimumTabsForGroup: 1,
  autoCollapseEnabled: false,
  autoCollapseDelayMs: 0,
  aiEnabled: false,
  aiProvider: "webllm",
  aiModelId: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC"
}

/**
 * Partial storage data for updates
 */
export type StorageUpdate = Partial<StorageSchema>
