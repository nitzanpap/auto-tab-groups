/**
 * Type definitions for background script messages
 */

import type { CustomRule, RuleData, RulesExportData, RulesStats } from "./rules"
import type { GroupByMode } from "./storage"

/**
 * All possible message actions
 */
export type MessageAction =
  | "group"
  | "ungroup"
  | "generateNewColors"
  | "restoreSavedColors"
  | "collapseAll"
  | "expandAll"
  | "toggleCollapse"
  | "getGroupsCollapseState"
  | "getAutoGroupState"
  | "getGroupNewTabsState"
  | "getOnlyApplyToNewTabs"
  | "toggleAutoGroup"
  | "toggleGroupNewTabs"
  | "getGroupByMode"
  | "setGroupByMode"
  | "getMinimumTabsForGroup"
  | "setMinimumTabsForGroup"
  | "getCustomRules"
  | "addCustomRule"
  | "updateCustomRule"
  | "deleteCustomRule"
  | "getRulesStats"
  | "exportRules"
  | "importRules"
  | "getExportStats"

/**
 * Base message structure
 */
interface BaseMessage {
  action: MessageAction
}

/**
 * Messages that don't require additional parameters
 */
export interface SimpleMessage extends BaseMessage {
  action:
    | "group"
    | "ungroup"
    | "generateNewColors"
    | "restoreSavedColors"
    | "collapseAll"
    | "expandAll"
    | "toggleCollapse"
    | "getGroupsCollapseState"
    | "getAutoGroupState"
    | "getGroupNewTabsState"
    | "getOnlyApplyToNewTabs"
    | "getGroupByMode"
    | "getMinimumTabsForGroup"
    | "getCustomRules"
    | "getRulesStats"
    | "exportRules"
    | "getExportStats"
}

/**
 * Toggle auto-group message
 */
export interface ToggleAutoGroupMessage extends BaseMessage {
  action: "toggleAutoGroup"
  enabled: boolean
}

/**
 * Toggle group new tabs message
 */
export interface ToggleGroupNewTabsMessage extends BaseMessage {
  action: "toggleGroupNewTabs"
  enabled: boolean
}

/**
 * Set group-by mode message
 */
export interface SetGroupByModeMessage extends BaseMessage {
  action: "setGroupByMode"
  mode: GroupByMode
}

/**
 * Set minimum tabs for group message
 */
export interface SetMinimumTabsMessage extends BaseMessage {
  action: "setMinimumTabsForGroup"
  minimumTabs: number
}

/**
 * Add custom rule message
 */
export interface AddCustomRuleMessage extends BaseMessage {
  action: "addCustomRule"
  ruleData: RuleData
}

/**
 * Update custom rule message
 */
export interface UpdateCustomRuleMessage extends BaseMessage {
  action: "updateCustomRule"
  ruleId: string
  ruleData: RuleData
}

/**
 * Delete custom rule message
 */
export interface DeleteCustomRuleMessage extends BaseMessage {
  action: "deleteCustomRule"
  ruleId: string
}

/**
 * Import rules message
 */
export interface ImportRulesMessage extends BaseMessage {
  action: "importRules"
  jsonData: string
  replaceExisting: boolean
}

/**
 * Union of all possible messages
 */
export type Message =
  | SimpleMessage
  | ToggleAutoGroupMessage
  | ToggleGroupNewTabsMessage
  | SetGroupByModeMessage
  | SetMinimumTabsMessage
  | AddCustomRuleMessage
  | UpdateCustomRuleMessage
  | DeleteCustomRuleMessage
  | ImportRulesMessage

/**
 * Base response structure
 */
interface BaseResponse {
  success?: boolean
  error?: string
}

/**
 * Response for simple success operations
 */
export interface SuccessResponse extends BaseResponse {
  success: true
}

/**
 * Response for error operations
 */
export interface ErrorResponse extends BaseResponse {
  success: false
  error: string
}

/**
 * Response for toggle collapse
 */
export interface ToggleCollapseResponse extends BaseResponse {
  success: true
  isCollapsed: boolean
}

/**
 * Response for get collapse state
 */
export interface CollapseStateResponse {
  isCollapsed: boolean
}

/**
 * Response for get auto-group state
 */
export interface AutoGroupStateResponse {
  enabled: boolean
}

/**
 * Response for get group-by mode
 */
export interface GroupByModeResponse {
  mode: GroupByMode
}

/**
 * Response for get minimum tabs
 */
export interface MinimumTabsResponse {
  minimumTabs: number
}

/**
 * Response for get custom rules
 */
export interface CustomRulesResponse {
  customRules: CustomRule[]
}

/**
 * Response for add rule
 */
export interface AddRuleResponse extends BaseResponse {
  success: boolean
  ruleId?: string
}

/**
 * Response for get rules stats
 */
export interface RulesStatsResponse {
  stats: RulesStats
}

/**
 * Response for export rules
 */
export interface ExportRulesResponse extends BaseResponse {
  success: boolean
  data?: RulesExportData
}

/**
 * Response for import rules
 */
export interface ImportRulesResponse extends BaseResponse {
  success: boolean
  imported?: number
  skipped?: number
  errors?: string[]
}

/**
 * Response for export stats
 */
export interface ExportStatsResponse extends BaseResponse {
  success: boolean
  stats?: RulesStats
}
