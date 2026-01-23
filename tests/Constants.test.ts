import { describe, expect, it } from "vitest"
import {
  getColorInfo,
  getRandomTabGroupColor,
  isValidColor,
  RULE_COLORS,
  TAB_GROUP_COLORS
} from "../utils/Constants"

describe("Constants", () => {
  describe("TAB_GROUP_COLORS", () => {
    it("should contain expected colors", () => {
      expect(TAB_GROUP_COLORS).toContain("grey")
      expect(TAB_GROUP_COLORS).toContain("blue")
      expect(TAB_GROUP_COLORS).toContain("red")
      expect(TAB_GROUP_COLORS).toContain("yellow")
      expect(TAB_GROUP_COLORS).toContain("green")
      expect(TAB_GROUP_COLORS).toContain("pink")
      expect(TAB_GROUP_COLORS).toContain("purple")
      expect(TAB_GROUP_COLORS).toContain("cyan")
      expect(TAB_GROUP_COLORS).toContain("orange")
    })

    it("should have 9 colors", () => {
      expect(TAB_GROUP_COLORS).toHaveLength(9)
    })
  })

  describe("RULE_COLORS", () => {
    it("should have 9 color entries", () => {
      expect(RULE_COLORS).toHaveLength(9)
    })

    it("should have name, value, and hex for each color", () => {
      for (const color of RULE_COLORS) {
        expect(color).toHaveProperty("name")
        expect(color).toHaveProperty("value")
        expect(color).toHaveProperty("hex")
        expect(typeof color.name).toBe("string")
        expect(typeof color.value).toBe("string")
        expect(color.hex).toMatch(/^#[0-9a-fA-F]{6}$/)
      }
    })

    it("should have matching values with TAB_GROUP_COLORS", () => {
      const ruleColorValues = RULE_COLORS.map(c => c.value)
      for (const tabColor of TAB_GROUP_COLORS) {
        expect(ruleColorValues).toContain(tabColor)
      }
    })
  })

  describe("getRandomTabGroupColor", () => {
    it("should return a valid color", () => {
      const color = getRandomTabGroupColor()
      expect(TAB_GROUP_COLORS).toContain(color)
    })

    it("should return different colors over multiple calls (probabilistic)", () => {
      const colors = new Set<string>()
      for (let i = 0; i < 100; i++) {
        colors.add(getRandomTabGroupColor())
      }
      // With 9 colors and 100 iterations, we should get at least 2 different colors
      expect(colors.size).toBeGreaterThan(1)
    })
  })

  describe("getColorInfo", () => {
    it("should return color info for valid color", () => {
      const info = getColorInfo("blue")
      expect(info).toBeDefined()
      expect(info?.name).toBe("Blue")
      expect(info?.value).toBe("blue")
      expect(info?.hex).toBe("#4285f4")
    })

    it("should return undefined for invalid color", () => {
      const info = getColorInfo("invalid" as "blue")
      expect(info).toBeUndefined()
    })

    it("should return correct info for each color", () => {
      const expectedColors = [
        { value: "grey", name: "Grey" },
        { value: "blue", name: "Blue" },
        { value: "red", name: "Red" },
        { value: "yellow", name: "Yellow" },
        { value: "green", name: "Green" },
        { value: "pink", name: "Pink" },
        { value: "purple", name: "Purple" },
        { value: "cyan", name: "Cyan" },
        { value: "orange", name: "Orange" }
      ]

      for (const expected of expectedColors) {
        const info = getColorInfo(expected.value as "blue")
        expect(info?.name).toBe(expected.name)
        expect(info?.value).toBe(expected.value)
      }
    })
  })

  describe("isValidColor", () => {
    it("should return true for valid colors", () => {
      expect(isValidColor("grey")).toBe(true)
      expect(isValidColor("blue")).toBe(true)
      expect(isValidColor("red")).toBe(true)
      expect(isValidColor("yellow")).toBe(true)
      expect(isValidColor("green")).toBe(true)
      expect(isValidColor("pink")).toBe(true)
      expect(isValidColor("purple")).toBe(true)
      expect(isValidColor("cyan")).toBe(true)
      expect(isValidColor("orange")).toBe(true)
    })

    it("should return false for invalid colors", () => {
      expect(isValidColor("invalid")).toBe(false)
      expect(isValidColor("")).toBe(false)
      expect(isValidColor("Gray")).toBe(false) // case-sensitive
      expect(isValidColor("BLUE")).toBe(false) // case-sensitive
    })

    it("should return false for empty string", () => {
      expect(isValidColor("")).toBe(false)
    })
  })
})
