import { describe, expect, it } from "vitest"
import {
  calculateGroupConstellationPositions,
  calculateOrbitalPositions,
  getGroupBoundingRadius
} from "../entrypoints/graph-3d.unlisted/modules/layout"
import { formatTabTitle } from "../entrypoints/graph-3d.unlisted/modules/nodes"

describe("3D Graph Layout & Collision Avoidance", () => {
  describe("formatTabTitle", () => {
    it("should strip common website suffixes cleanly and truncate to 14 chars", () => {
      expect(formatTabTitle("Coding Challenge · GitHub")).toBe("Coding Challen…")
      expect(formatTabTitle("Funny Cat Video - YouTube")).toBe("Funny Cat Vide…")
      expect(formatTabTitle("How to code - Google Search")).toBe("How to code")
    })

    it("should truncate long titles with ellipsis", () => {
      const longTitle = "A very extremely ultra super long tab title that exceeds bounds"
      const formatted = formatTabTitle(longTitle)
      expect(formatted.length).toBeLessThanOrEqual(16)
      expect(formatted.endsWith("…")).toBe(true)
    })

    it("should fallback gracefully on empty titles", () => {
      expect(formatTabTitle("", "https://news.ycombinator.com")).toBe("news.ycombinat…")
      expect(formatTabTitle("", "")).toBe("Untitled Tab")
    })
  })

  describe("getGroupBoundingRadius", () => {
    it("should scale bounding radius appropriately with tab count", () => {
      expect(getGroupBoundingRadius(0)).toBe(60)
      expect(getGroupBoundingRadius(5)).toBeGreaterThanOrEqual(200)
      expect(getGroupBoundingRadius(12)).toBeGreaterThan(getGroupBoundingRadius(5))
      expect(getGroupBoundingRadius(25)).toBeGreaterThan(getGroupBoundingRadius(12))
      expect(getGroupBoundingRadius(50)).toBeGreaterThan(getGroupBoundingRadius(25))
    })
  })

  describe("calculateOrbitalPositions", () => {
    it("should generate deterministic positions with outward direction vectors", () => {
      const orbits = calculateOrbitalPositions(8)
      expect(orbits.length).toBe(8)

      for (const orb of orbits) {
        expect(orb.radius).toBeGreaterThan(0)
        expect(orb.labelDirX).toBeDefined()
        expect(orb.labelDirY).toBeDefined()
        expect(orb.labelDirZ).toBeDefined()

        // Direction vector should be normalized (approx length 1)
        const len = Math.sqrt(
          orb.labelDirX * orb.labelDirX +
          orb.labelDirY * orb.labelDirY +
          orb.labelDirZ * orb.labelDirZ
        )
        expect(len).toBeCloseTo(1.0, 1)
      }
    })

    it("should generate multiple concentric rings for large tab counts", () => {
      const orbits = calculateOrbitalPositions(25)
      const ringIndices = new Set(orbits.map(o => o.ringIndex))
      expect(ringIndices.size).toBe(3)
    })
  })

  describe("calculateGroupConstellationPositions", () => {
    it("should provide ample non-overlapping spacing between groups", () => {
      const groups = [
        { id: "group-1", tabCount: 15 },
        { id: "group-2", tabCount: 25 },
        { id: "group-3", tabCount: 5 }
      ]

      const positions = calculateGroupConstellationPositions(groups)
      expect(positions.size).toBe(3)

      const p1 = positions.get("group-1")!
      const p2 = positions.get("group-2")!
      const p3 = positions.get("group-3")!

      const dist12 = Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z)
      const dist23 = Math.hypot(p2.x - p3.x, p2.y - p3.y, p2.z - p3.z)
      const dist13 = Math.hypot(p1.x - p3.x, p1.y - p3.y, p1.z - p3.z)

      const r1 = getGroupBoundingRadius(15)
      const r2 = getGroupBoundingRadius(25)
      const r3 = getGroupBoundingRadius(5)

      // Verify distance between group centers is greater than sum of group radii
      expect(dist12).toBeGreaterThanOrEqual(r1 + r2)
      expect(dist23).toBeGreaterThanOrEqual(r2 + r3)
      expect(dist13).toBeGreaterThanOrEqual(r1 + r3)
    })
  })
})

