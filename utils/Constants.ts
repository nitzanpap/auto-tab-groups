/**
 * Constants used throughout the Auto Tab Groups extension
 */

import type { TabGroupColor, RuleColorInfo } from "../types";

/**
 * Available colors for tab groups in Chrome/Firefox
 */
export const TAB_GROUP_COLORS: readonly TabGroupColor[] = [
  "grey",
  "blue",
  "red",
  "yellow",
  "green",
  "pink",
  "purple",
  "cyan",
  "orange",
] as const;

/**
 * Color information for UI display
 */
export const RULE_COLORS: readonly RuleColorInfo[] = [
  { name: "Blue", value: "blue", hex: "#4285f4" },
  { name: "Red", value: "red", hex: "#ea4335" },
  { name: "Yellow", value: "yellow", hex: "#fbbc04" },
  { name: "Green", value: "green", hex: "#34a853" },
  { name: "Pink", value: "pink", hex: "#ff6d9d" },
  { name: "Purple", value: "purple", hex: "#9c27b0" },
  { name: "Cyan", value: "cyan", hex: "#00acc1" },
  { name: "Orange", value: "orange", hex: "#ff9800" },
  { name: "Grey", value: "grey", hex: "#9e9e9e" },
] as const;

/**
 * Gets a random color from available tab group colors
 */
export function getRandomTabGroupColor(): TabGroupColor {
  return TAB_GROUP_COLORS[Math.floor(Math.random() * TAB_GROUP_COLORS.length)];
}

/**
 * Gets color information by color value
 */
export function getColorInfo(
  colorValue: TabGroupColor,
): RuleColorInfo | undefined {
  return RULE_COLORS.find((color) => color.value === colorValue);
}

/**
 * Checks if a color value is valid
 */
export function isValidColor(color: string): color is TabGroupColor {
  return TAB_GROUP_COLORS.includes(color as TabGroupColor);
}
