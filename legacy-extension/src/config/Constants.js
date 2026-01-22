/**
 * Constants used throughout the Auto Tab Groups extension
 */

// Available colors for tab groups in Chrome/Firefox
export const TAB_GROUP_COLORS = [
  "grey",
  "blue",
  "red",
  "yellow",
  "green",
  "pink",
  "purple",
  "cyan",
  "orange"
]

/**
 * Gets a random color from available tab group colors
 * @returns {string} Random color name
 */
export function getRandomTabGroupColor() {
  return TAB_GROUP_COLORS[Math.floor(Math.random() * TAB_GROUP_COLORS.length)]
}
