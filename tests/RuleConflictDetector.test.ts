import { describe, expect, it } from "vitest"
import type { CustomRule } from "../types"
import { checkPatternOverlap, detectConflicts } from "../utils/RuleConflictDetector"

function makeRule(overrides: Partial<CustomRule> = {}): CustomRule {
  return {
    id: "rule-1",
    name: "Test Rule",
    domains: ["example.com"],
    color: "blue",
    enabled: true,
    priority: 1,
    createdAt: new Date().toISOString(),
    ...overrides
  }
}

describe("RuleConflictDetector", () => {
  describe("detectConflicts", () => {
    it("should return empty array when no existing rules", () => {
      const conflicts = detectConflicts(["example.com"], [])
      expect(conflicts).toEqual([])
    })

    it("should return empty array when patterns do not overlap", () => {
      const existing = [makeRule({ id: "r1", name: "Other", domains: ["other.com"] })]
      const conflicts = detectConflicts(["example.com"], existing)
      expect(conflicts).toEqual([])
    })

    it("should return empty array for empty patterns", () => {
      const existing = [makeRule()]
      const conflicts = detectConflicts([], existing)
      expect(conflicts).toEqual([])
    })

    it("should exclude rule with matching excludeRuleId", () => {
      const existing = [makeRule({ id: "r1", domains: ["example.com"] })]
      const conflicts = detectConflicts(["example.com"], existing, "r1")
      expect(conflicts).toEqual([])
    })

    describe("exact duplicate detection", () => {
      it("should detect exact pattern duplicate", () => {
        const existing = [makeRule({ id: "r1", name: "Rule A", domains: ["example.com"] })]
        const conflicts = detectConflicts(["example.com"], existing)
        expect(conflicts).toHaveLength(1)
        expect(conflicts[0].conflictType).toBe("exact_duplicate")
        expect(conflicts[0].sourcePattern).toBe("example.com")
        expect(conflicts[0].targetPattern).toBe("example.com")
        expect(conflicts[0].targetRuleId).toBe("r1")
        expect(conflicts[0].targetRuleName).toBe("Rule A")
      })

      it("should detect case-insensitive exact duplicate", () => {
        const existing = [makeRule({ id: "r1", name: "Rule A", domains: ["Example.COM"] })]
        const conflicts = detectConflicts(["example.com"], existing)
        expect(conflicts).toHaveLength(1)
        expect(conflicts[0].conflictType).toBe("exact_duplicate")
      })

      it("should detect duplicates across multiple existing rules", () => {
        const existing = [
          makeRule({ id: "r1", name: "Rule A", domains: ["example.com"] }),
          makeRule({ id: "r2", name: "Rule B", domains: ["example.com", "other.com"] })
        ]
        const conflicts = detectConflicts(["example.com"], existing)
        expect(conflicts).toHaveLength(2)
        expect(conflicts[0].targetRuleId).toBe("r1")
        expect(conflicts[1].targetRuleId).toBe("r2")
      })
    })

    describe("wildcard subsumption detection", () => {
      it("should detect *.domain.com subsumes www.domain.com", () => {
        const existing = [makeRule({ id: "r1", name: "Wildcard Rule", domains: ["*.example.com"] })]
        const conflicts = detectConflicts(["www.example.com"], existing)
        expect(conflicts).toHaveLength(1)
        expect(conflicts[0].conflictType).toBe("subsumed_by_wildcard")
        expect(conflicts[0].description).toContain("*.example.com")
      })

      it("should detect *.domain.com subsumes sub.domain.com", () => {
        const existing = [makeRule({ id: "r1", name: "Wildcard Rule", domains: ["*.example.com"] })]
        const conflicts = detectConflicts(["sub.example.com"], existing)
        expect(conflicts).toHaveLength(1)
        expect(conflicts[0].conflictType).toBe("subsumed_by_wildcard")
      })

      it("should detect new *.domain.com subsumes existing www.domain.com", () => {
        const existing = [
          makeRule({ id: "r1", name: "Specific Rule", domains: ["www.example.com"] })
        ]
        const conflicts = detectConflicts(["*.example.com"], existing)
        expect(conflicts).toHaveLength(1)
        expect(conflicts[0].conflictType).toBe("wildcard_subsumes")
      })

      it("should detect new *.domain.com subsumes multiple existing subdomains", () => {
        const existing = [
          makeRule({
            id: "r1",
            name: "Specific Rule",
            domains: ["www.example.com", "api.example.com"]
          })
        ]
        const conflicts = detectConflicts(["*.example.com"], existing)
        expect(conflicts).toHaveLength(2)
        expect(conflicts.every(c => c.conflictType === "wildcard_subsumes")).toBe(true)
      })

      it("should not flag *.example.com vs *.example.org", () => {
        const existing = [makeRule({ id: "r1", name: "Other", domains: ["*.example.org"] })]
        const conflicts = detectConflicts(["*.example.com"], existing)
        expect(conflicts).toEqual([])
      })
    })

    describe("TLD wildcard overlap detection", () => {
      it("should detect example.** overlaps with example.com", () => {
        const existing = [makeRule({ id: "r1", name: "Specific TLD", domains: ["example.com"] })]
        const conflicts = detectConflicts(["example.**"], existing)
        expect(conflicts).toHaveLength(1)
        expect(conflicts[0].conflictType).toBe("tld_wildcard_overlap")
      })

      it("should detect existing example.** overlaps with new example.org", () => {
        const existing = [makeRule({ id: "r1", name: "TLD Wildcard", domains: ["example.**"] })]
        const conflicts = detectConflicts(["example.org"], existing)
        expect(conflicts).toHaveLength(1)
        expect(conflicts[0].conflictType).toBe("tld_wildcard_overlap")
      })

      it("should not flag example.** vs other.com", () => {
        const existing = [makeRule({ id: "r1", name: "Other", domains: ["other.com"] })]
        const conflicts = detectConflicts(["example.**"], existing)
        expect(conflicts).toEqual([])
      })
    })

    describe("segment extraction overlap detection", () => {
      it("should detect {sub}.example.com overlaps with *.example.com", () => {
        const existing = [makeRule({ id: "r1", name: "Wildcard Rule", domains: ["*.example.com"] })]
        const conflicts = detectConflicts(["{sub}.example.com"], existing)
        expect(conflicts).toHaveLength(1)
        expect(conflicts[0].conflictType).toBe("segment_overlap")
      })

      it("should detect *.example.com overlaps with existing {sub}.example.com", () => {
        const existing = [
          makeRule({ id: "r1", name: "Segment Rule", domains: ["{sub}.example.com"] })
        ]
        const conflicts = detectConflicts(["*.example.com"], existing)
        expect(conflicts).toHaveLength(1)
        expect(conflicts[0].conflictType).toBe("segment_overlap")
      })

      it("should detect {sub}.example.com overlaps with specific www.example.com", () => {
        const existing = [makeRule({ id: "r1", name: "WWW Rule", domains: ["www.example.com"] })]
        const conflicts = detectConflicts(["{sub}.example.com"], existing)
        expect(conflicts).toHaveLength(1)
      })
    })

    describe("multiple patterns and rules", () => {
      it("should detect conflicts across multiple source patterns", () => {
        const existing = [
          makeRule({ id: "r1", name: "Rule A", domains: ["example.com"] }),
          makeRule({ id: "r2", name: "Rule B", domains: ["other.com"] })
        ]
        const conflicts = detectConflicts(["example.com", "other.com"], existing)
        expect(conflicts).toHaveLength(2)
        expect(conflicts[0].targetRuleId).toBe("r1")
        expect(conflicts[1].targetRuleId).toBe("r2")
      })

      it("should not produce duplicate conflicts for the same pair", () => {
        const existing = [makeRule({ id: "r1", name: "Rule A", domains: ["example.com"] })]
        const conflicts = detectConflicts(["example.com"], existing)
        expect(conflicts).toHaveLength(1)
      })
    })

    describe("edge cases", () => {
      it("should handle disabled existing rules (still detects)", () => {
        const existing = [
          makeRule({ id: "r1", name: "Disabled Rule", domains: ["example.com"], enabled: false })
        ]
        const conflicts = detectConflicts(["example.com"], existing)
        expect(conflicts).toHaveLength(1)
      })

      it("should include human-readable description for every conflict", () => {
        const existing = [makeRule({ id: "r1", name: "Rule A", domains: ["*.example.com"] })]
        const conflicts = detectConflicts(["www.example.com"], existing)
        expect(conflicts[0].description).toBeTruthy()
        expect(typeof conflicts[0].description).toBe("string")
        expect(conflicts[0].description.length).toBeGreaterThan(0)
      })
    })
  })

  describe("checkPatternOverlap", () => {
    it("should return exact_duplicate for identical patterns", () => {
      const result = checkPatternOverlap("example.com", "example.com")
      expect(result).toBe("exact_duplicate")
    })

    it("should return exact_duplicate for case-insensitive match", () => {
      const result = checkPatternOverlap("Example.COM", "example.com")
      expect(result).toBe("exact_duplicate")
    })

    it("should return wildcard_subsumes when source is wildcard", () => {
      const result = checkPatternOverlap("*.example.com", "www.example.com")
      expect(result).toBe("wildcard_subsumes")
    })

    it("should return subsumed_by_wildcard when target is wildcard", () => {
      const result = checkPatternOverlap("www.example.com", "*.example.com")
      expect(result).toBe("subsumed_by_wildcard")
    })

    it("should return tld_wildcard_overlap for TLD wildcard source", () => {
      const result = checkPatternOverlap("example.**", "example.com")
      expect(result).toBe("tld_wildcard_overlap")
    })

    it("should return tld_wildcard_overlap for TLD wildcard target", () => {
      const result = checkPatternOverlap("example.com", "example.**")
      expect(result).toBe("tld_wildcard_overlap")
    })

    it("should return segment_overlap for segment vs wildcard", () => {
      const result = checkPatternOverlap("{sub}.example.com", "*.example.com")
      expect(result).toBe("segment_overlap")
    })

    it("should return segment_overlap for wildcard vs segment", () => {
      const result = checkPatternOverlap("*.example.com", "{sub}.example.com")
      expect(result).toBe("segment_overlap")
    })

    it("should return segment_overlap for segment vs specific subdomain", () => {
      const result = checkPatternOverlap("{sub}.example.com", "www.example.com")
      expect(result).toBe("segment_overlap")
    })

    it("should return null for non-overlapping patterns", () => {
      const result = checkPatternOverlap("example.com", "other.com")
      expect(result).toBeNull()
    })

    it("should return null for *.example.com vs example.org", () => {
      const result = checkPatternOverlap("*.example.com", "example.org")
      expect(result).toBeNull()
    })

    it("should return null for both being wildcards on different domains", () => {
      const result = checkPatternOverlap("*.example.com", "*.other.com")
      expect(result).toBeNull()
    })
  })
})
