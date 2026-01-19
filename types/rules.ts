/**
 * Type definitions for custom rules
 */

/**
 * Available colors for tab groups
 */
export const TAB_GROUP_COLORS = [
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
] as const;

export type TabGroupColor = (typeof TAB_GROUP_COLORS)[number];

/**
 * Color information for UI display
 */
export interface RuleColorInfo {
  name: string;
  value: TabGroupColor;
  hex: string;
}

/**
 * Custom rule for grouping tabs
 */
export interface CustomRule {
  /** Unique identifier for the rule */
  id: string;
  /** Display name for the rule/group */
  name: string;
  /** Array of domain patterns to match */
  domains: string[];
  /** Color for the tab group */
  color: TabGroupColor;
  /** Whether the rule is enabled */
  enabled: boolean;
  /** Priority for rule matching (higher = more priority) */
  priority: number;
  /** Minimum tabs required to form this group (optional, overrides global) */
  minimumTabs?: number;
  /** ISO date string when rule was created */
  createdAt: string;
}

/**
 * Rule data for creating/updating rules (without id and createdAt)
 */
export interface RuleData {
  name: string;
  domains: string[];
  color?: TabGroupColor;
  enabled?: boolean;
  priority?: number;
  minimumTabs?: number;
  id?: string;
  createdAt?: string;
}

/**
 * Result of rule validation
 */
export interface RuleValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Result of pattern validation
 */
export interface PatternValidationResult {
  isValid: boolean;
  error?: string | null;
}

/**
 * Statistics about rules
 */
export interface RulesStats {
  totalRules: number;
  enabledRules: number;
  disabledRules: number;
  totalPatterns: number;
}

/**
 * Export format for rules
 */
export interface RulesExportData {
  version: string;
  exportedAt: string;
  rules: CustomRule[];
}

/**
 * Result of importing rules
 */
export interface RulesImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}
