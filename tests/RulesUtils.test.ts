import { describe, expect, it } from "vitest"
import type { CustomRule, RuleData } from "../types"
import {
  createSafeRule,
  formatDomainsDisplay,
  isIPv4Address,
  isIPv4Pattern,
  isValidPathSegment,
  matchIPv4,
  parseDomainsText,
  sanitizePatterns,
  validateDomainPattern,
  validateHostPattern,
  validateIPv4Pattern,
  validatePathPattern,
  validateRuleData,
  validateRuleName
} from "../utils/RulesUtils"

describe("RulesUtils", () => {
  describe("isIPv4Address", () => {
    it("should return true for valid IPv4 address", () => {
      expect(isIPv4Address("192.168.1.1")).toBe(true)
    })

    it("should return true for loopback address", () => {
      expect(isIPv4Address("127.0.0.1")).toBe(true)
    })

    it("should return true for 0.0.0.0", () => {
      expect(isIPv4Address("0.0.0.0")).toBe(true)
    })

    it("should return true for 255.255.255.255", () => {
      expect(isIPv4Address("255.255.255.255")).toBe(true)
    })

    it("should return false for value > 255", () => {
      expect(isIPv4Address("256.1.1.1")).toBe(false)
    })

    it("should return false for negative value", () => {
      expect(isIPv4Address("-1.1.1.1")).toBe(false)
    })

    it("should return false for leading zeros", () => {
      expect(isIPv4Address("01.1.1.1")).toBe(false)
    })

    it("should return false for too few octets", () => {
      expect(isIPv4Address("192.168.1")).toBe(false)
    })

    it("should return false for too many octets", () => {
      expect(isIPv4Address("192.168.1.1.1")).toBe(false)
    })

    it("should return false for empty string", () => {
      expect(isIPv4Address("")).toBe(false)
    })

    it("should return false for null", () => {
      expect(isIPv4Address(null as unknown as string)).toBe(false)
    })

    it("should return false for domain", () => {
      expect(isIPv4Address("example.com")).toBe(false)
    })

    it("should return false for wildcard pattern", () => {
      expect(isIPv4Address("192.168.*.*")).toBe(false)
    })
  })

  describe("isIPv4Pattern", () => {
    it("should return true for valid IPv4 address", () => {
      expect(isIPv4Pattern("192.168.1.1")).toBe(true)
    })

    it("should return true for wildcard in first octet", () => {
      expect(isIPv4Pattern("*.168.1.1")).toBe(true)
    })

    it("should return true for wildcard in last octet", () => {
      expect(isIPv4Pattern("192.168.1.*")).toBe(true)
    })

    it("should return true for multiple wildcards", () => {
      expect(isIPv4Pattern("192.168.*.*")).toBe(true)
    })

    it("should return true for all wildcards", () => {
      expect(isIPv4Pattern("*.*.*.*")).toBe(true)
    })

    it("should return false for empty string", () => {
      expect(isIPv4Pattern("")).toBe(false)
    })

    it("should return false for invalid octet", () => {
      expect(isIPv4Pattern("192.168.1.256")).toBe(false)
    })
  })

  describe("validateIPv4Pattern", () => {
    it("should validate correct IPv4 pattern", () => {
      const result = validateIPv4Pattern("192.168.1.1")
      expect(result.isValid).toBe(true)
    })

    it("should validate pattern with wildcard", () => {
      const result = validateIPv4Pattern("192.168.1.*")
      expect(result.isValid).toBe(true)
    })

    it("should reject empty pattern", () => {
      const result = validateIPv4Pattern("")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("IPv4 pattern must be a string")
    })

    it("should reject whitespace-only pattern", () => {
      const result = validateIPv4Pattern("   ")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("IPv4 pattern cannot be empty")
    })

    it("should reject non-string", () => {
      const result = validateIPv4Pattern(null as unknown as string)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("IPv4 pattern must be a string")
    })

    it("should reject wrong number of octets", () => {
      const result = validateIPv4Pattern("192.168.1")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("IPv4 address must have exactly 4 octets")
    })

    it("should reject invalid octet characters", () => {
      const result = validateIPv4Pattern("192.168.1.abc")
      expect(result.isValid).toBe(false)
      expect(result.error).toContain("Invalid IPv4 octet")
    })

    it("should reject octet > 255", () => {
      const result = validateIPv4Pattern("192.168.1.300")
      expect(result.isValid).toBe(false)
      expect(result.error).toContain("must be between 0 and 255")
    })

    it("should reject leading zeros", () => {
      const result = validateIPv4Pattern("192.168.01.1")
      expect(result.isValid).toBe(false)
      expect(result.error).toContain("cannot have leading zeros")
    })
  })

  describe("matchIPv4", () => {
    it("should match exact IP", () => {
      expect(matchIPv4("192.168.1.1", "192.168.1.1")).toBe(true)
    })

    it("should match with last octet wildcard", () => {
      expect(matchIPv4("192.168.1.50", "192.168.1.*")).toBe(true)
    })

    it("should match with multiple wildcards", () => {
      expect(matchIPv4("192.168.5.10", "192.168.*.*")).toBe(true)
    })

    it("should not match different subnet", () => {
      expect(matchIPv4("192.168.2.1", "192.168.1.*")).toBe(false)
    })

    it("should return false for invalid IP", () => {
      expect(matchIPv4("invalid", "192.168.1.*")).toBe(false)
    })

    it("should return false for invalid pattern", () => {
      expect(matchIPv4("192.168.1.1", "invalid")).toBe(false)
    })
  })

  describe("validateDomainPattern", () => {
    it("should validate simple domain", () => {
      const result = validateDomainPattern("example.com")
      expect(result.isValid).toBe(true)
    })

    it("should validate subdomain", () => {
      const result = validateDomainPattern("blog.example.com")
      expect(result.isValid).toBe(true)
    })

    it("should validate wildcard subdomain pattern", () => {
      const result = validateDomainPattern("*.example.com")
      expect(result.isValid).toBe(true)
    })

    it("should validate TLD wildcard pattern", () => {
      const result = validateDomainPattern("google.**")
      expect(result.isValid).toBe(true)
    })

    it("should validate combined wildcard pattern", () => {
      const result = validateDomainPattern("*.google.**")
      expect(result.isValid).toBe(true)
    })

    it("should reject empty pattern", () => {
      const result = validateDomainPattern("")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Domain pattern cannot be empty")
    })

    it("should reject invalid ** pattern without prefix", () => {
      const result = validateDomainPattern("**")
      expect(result.isValid).toBe(false)
    })

    it("should reject * pattern without domain", () => {
      const result = validateDomainPattern("*.")
      expect(result.isValid).toBe(false)
    })

    it("should reject domain starting with dot", () => {
      const result = validateDomainPattern(".example.com")
      expect(result.isValid).toBe(false)
    })

    it("should reject domain ending with dot", () => {
      const result = validateDomainPattern("example.com.")
      expect(result.isValid).toBe(false)
    })

    it("should reject consecutive dots", () => {
      const result = validateDomainPattern("example..com")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Domain cannot contain consecutive dots")
    })

    it("should reject domain starting with hyphen", () => {
      const result = validateDomainPattern("-example.com")
      expect(result.isValid).toBe(false)
    })

    it("should reject pattern ending with hyphen", () => {
      const result = validateDomainPattern("example.com-")
      expect(result.isValid).toBe(false)
    })

    it("should reject multiple wildcards in domain pattern", () => {
      const result = validateDomainPattern("*.*.example.com")
      expect(result.isValid).toBe(false)
    })
  })

  describe("validateHostPattern", () => {
    it("should validate domain pattern", () => {
      const result = validateHostPattern("example.com")
      expect(result.isValid).toBe(true)
    })

    it("should validate IPv4 pattern", () => {
      const result = validateHostPattern("192.168.1.*")
      expect(result.isValid).toBe(true)
    })

    it("should reject empty pattern", () => {
      const result = validateHostPattern("")
      expect(result.isValid).toBe(false)
    })
  })

  describe("validatePathPattern", () => {
    it("should validate simple path", () => {
      const result = validatePathPattern("/api/users")
      expect(result.isValid).toBe(true)
    })

    it("should validate path with wildcard", () => {
      const result = validatePathPattern("/api/*")
      expect(result.isValid).toBe(true)
    })

    it("should validate path with ** wildcard", () => {
      const result = validatePathPattern("/api/**/users")
      expect(result.isValid).toBe(true)
    })

    it("should reject empty path", () => {
      const result = validatePathPattern("")
      expect(result.isValid).toBe(false)
    })

    it("should reject path that is just /", () => {
      const result = validatePathPattern("/")
      expect(result.isValid).toBe(false)
    })

    it("should reject too long path", () => {
      const result = validatePathPattern(`/${"a".repeat(101)}`)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Path pattern too long (max 100 characters)")
    })

    it("should reject invalid characters", () => {
      const result = validatePathPattern("/api/<script>")
      expect(result.isValid).toBe(false)
    })

    it("should reject consecutive slashes", () => {
      const result = validatePathPattern("/api//users")
      expect(result.isValid).toBe(false)
    })
  })

  describe("isValidPathSegment", () => {
    it("should return true for valid segment", () => {
      expect(isValidPathSegment("api")).toBe(true)
    })

    it("should return true for segment with hyphen", () => {
      expect(isValidPathSegment("api-v2")).toBe(true)
    })

    it("should return true for empty segment", () => {
      expect(isValidPathSegment("")).toBe(true)
    })

    it("should return false for segment with invalid chars", () => {
      expect(isValidPathSegment("api<>")).toBe(false)
    })
  })

  describe("validateRuleName", () => {
    it("should validate simple name", () => {
      const result = validateRuleName("My Rule")
      expect(result.isValid).toBe(true)
    })

    it("should validate name with special chars", () => {
      const result = validateRuleName("Rule (Test) - v1.0!")
      expect(result.isValid).toBe(true)
    })

    // Unicode and international character support tests
    it("should accept Chinese characters in rule name", () => {
      const result = validateRuleName("工作")
      expect(result.isValid).toBe(true)
    })

    it("should accept Japanese characters in rule name", () => {
      const result = validateRuleName("日本語テスト")
      expect(result.isValid).toBe(true)
    })

    it("should accept Korean characters in rule name", () => {
      const result = validateRuleName("한국어")
      expect(result.isValid).toBe(true)
    })

    it("should accept Arabic characters in rule name", () => {
      const result = validateRuleName("العربية")
      expect(result.isValid).toBe(true)
    })

    it("should accept Russian characters in rule name", () => {
      const result = validateRuleName("Тест на русском")
      expect(result.isValid).toBe(true)
    })

    it("should accept emojis in rule name", () => {
      const result = validateRuleName("🎉 Fun Sites")
      expect(result.isValid).toBe(true)
    })

    it("should accept mixed unicode and ASCII in rule name", () => {
      const result = validateRuleName("Work 工作 Apps")
      expect(result.isValid).toBe(true)
    })

    it("should enforce 50 character limit regardless of unicode", () => {
      const longName = "中".repeat(51)
      const result = validateRuleName(longName)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Rule name cannot exceed 50 characters")
    })

    it("should still reject dangerous characters like angle brackets", () => {
      const result = validateRuleName("<script>alert('xss')</script>")
      expect(result.isValid).toBe(false)
    })

    it("should reject empty name", () => {
      const result = validateRuleName("")
      expect(result.isValid).toBe(false)
    })

    it("should reject whitespace-only name", () => {
      const result = validateRuleName("   ")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Rule name cannot be empty")
    })

    it("should reject non-string", () => {
      const result = validateRuleName(null as unknown as string)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Rule name must be a string")
    })

    it("should reject name exceeding 50 chars", () => {
      const result = validateRuleName("a".repeat(51))
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Rule name cannot exceed 50 characters")
    })

    it("should reject invalid characters", () => {
      const result = validateRuleName("Rule <script>")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Rule name contains invalid characters")
    })
  })

  describe("parseDomainsText", () => {
    it("should parse single domain", () => {
      expect(parseDomainsText("example.com")).toEqual(["example.com"])
    })

    it("should parse multiple domains", () => {
      const result = parseDomainsText("example.com\ngoogle.com\nfacebook.com")
      expect(result).toEqual(["example.com", "google.com", "facebook.com"])
    })

    it("should trim whitespace", () => {
      const result = parseDomainsText("  example.com  \n  google.com  ")
      expect(result).toEqual(["example.com", "google.com"])
    })

    it("should convert to lowercase", () => {
      const result = parseDomainsText("EXAMPLE.COM\nGoogle.Com")
      expect(result).toEqual(["example.com", "google.com"])
    })

    it("should remove duplicates", () => {
      const result = parseDomainsText("example.com\nexample.com\nEXAMPLE.COM")
      expect(result).toEqual(["example.com"])
    })

    it("should filter empty lines", () => {
      const result = parseDomainsText("example.com\n\n\ngoogle.com")
      expect(result).toEqual(["example.com", "google.com"])
    })

    it("should return empty array for empty string", () => {
      expect(parseDomainsText("")).toEqual([])
    })

    it("should return empty array for null", () => {
      expect(parseDomainsText(null as unknown as string)).toEqual([])
    })
  })

  describe("sanitizePatterns", () => {
    it("should return valid patterns", () => {
      const result = sanitizePatterns(["example.com", "*.google.com"])
      expect(result).toEqual(["example.com", "*.google.com"])
    })

    it("should remove invalid patterns", () => {
      const result = sanitizePatterns(["example.com", "", "   "])
      expect(result).toEqual(["example.com"])
    })

    it("should remove duplicates", () => {
      const result = sanitizePatterns(["example.com", "EXAMPLE.COM"])
      expect(result).toEqual(["example.com"])
    })

    it("should lowercase patterns", () => {
      const result = sanitizePatterns(["EXAMPLE.COM"])
      expect(result).toEqual(["example.com"])
    })

    it("should return empty array for non-array", () => {
      expect(sanitizePatterns(null as unknown as string[])).toEqual([])
    })
  })

  describe("formatDomainsDisplay", () => {
    it("should return 'No domains' for empty array", () => {
      expect(formatDomainsDisplay([])).toBe("No domains")
    })

    it("should return single domain", () => {
      expect(formatDomainsDisplay(["example.com"])).toBe("example.com")
    })

    it("should join multiple domains", () => {
      expect(formatDomainsDisplay(["a.com", "b.com"])).toBe("a.com, b.com")
    })

    it("should truncate long list", () => {
      const domains = ["example.com", "google.com", "facebook.com", "twitter.com", "github.com"]
      const result = formatDomainsDisplay(domains, 40)
      expect(result).toContain("and")
      expect(result).toContain("more")
    })

    it("should return 'No domains' for null", () => {
      expect(formatDomainsDisplay(null as unknown as string[])).toBe("No domains")
    })
  })

  describe("validateRuleData", () => {
    const validRuleData: RuleData = {
      name: "Test Rule",
      domains: ["example.com"],
      color: "blue"
    }

    it("should validate correct rule data", () => {
      const result = validateRuleData(validRuleData)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("should reject empty name", () => {
      const result = validateRuleData({ ...validRuleData, name: "" })
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes("name"))).toBe(true)
    })

    it("should reject empty domains array", () => {
      const result = validateRuleData({ ...validRuleData, domains: [] })
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes("domain"))).toBe(true)
    })

    it("should reject too many domains", () => {
      const domains = Array(21)
        .fill(null)
        .map((_, i) => `domain${i}.com`)
      const result = validateRuleData({ ...validRuleData, domains })
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes("Maximum 20"))).toBe(true)
    })

    it("should reject invalid pattern in domains", () => {
      const result = validateRuleData({ ...validRuleData, domains: ["   "] })
      expect(result.isValid).toBe(false)
    })

    it("should warn about unknown color", () => {
      const result = validateRuleData({ ...validRuleData, color: "unknown" as "blue" })
      expect(result.warnings.some(w => w.includes("Unknown color"))).toBe(true)
    })

    it("should reject invalid priority", () => {
      const result = validateRuleData({ ...validRuleData, priority: -1 })
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes("Priority"))).toBe(true)
    })

    it("should detect duplicate rule names", () => {
      const existingRules: CustomRule[] = [
        {
          id: "existing",
          name: "Test Rule",
          domains: ["other.com"],
          color: "blue",
          enabled: true,
          priority: 1,
          createdAt: new Date().toISOString()
        }
      ]
      const result = validateRuleData(validRuleData, existingRules)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes("already exists"))).toBe(true)
    })

    it("should allow same name if same rule id", () => {
      const ruleWithId = { ...validRuleData, id: "existing" }
      const existingRules: CustomRule[] = [
        {
          id: "existing",
          name: "Test Rule",
          domains: ["other.com"],
          color: "blue",
          enabled: true,
          priority: 1,
          createdAt: new Date().toISOString()
        }
      ]
      const result = validateRuleData(ruleWithId, existingRules)
      expect(result.errors.some(e => e.includes("already exists"))).toBe(false)
    })

    it("should warn about pattern conflicts", () => {
      const existingRules: CustomRule[] = [
        {
          id: "existing",
          name: "Other Rule",
          domains: ["example.com"],
          color: "blue",
          enabled: true,
          priority: 1,
          createdAt: new Date().toISOString()
        }
      ]
      const result = validateRuleData(validRuleData, existingRules)
      expect(result.warnings.some(w => w.includes("already exist in rule"))).toBe(true)
    })
  })

  describe("createSafeRule", () => {
    it("should create rule with defaults", () => {
      const rule = createSafeRule({ name: "Test", domains: ["example.com"] })
      expect(rule.id).toBeDefined()
      expect(rule.name).toBe("Test")
      expect(rule.domains).toEqual(["example.com"])
      expect(rule.color).toBe("blue")
      expect(rule.enabled).toBe(true)
      expect(rule.priority).toBe(1)
      expect(rule.createdAt).toBeDefined()
    })

    it("should trim name", () => {
      const rule = createSafeRule({ name: "  Test  ", domains: ["example.com"] })
      expect(rule.name).toBe("Test")
    })

    it("should use provided id", () => {
      const rule = createSafeRule({ id: "my-id", name: "Test", domains: ["example.com"] })
      expect(rule.id).toBe("my-id")
    })

    it("should sanitize domains", () => {
      const rule = createSafeRule({ name: "Test", domains: ["EXAMPLE.COM", ""] })
      expect(rule.domains).toEqual(["example.com"])
    })

    it("should use valid color", () => {
      const rule = createSafeRule({ name: "Test", domains: ["example.com"], color: "red" })
      expect(rule.color).toBe("red")
    })

    it("should default to blue for invalid color", () => {
      const rule = createSafeRule({
        name: "Test",
        domains: ["example.com"],
        color: "invalid" as "blue"
      })
      expect(rule.color).toBe("blue")
    })

    it("should use provided priority if valid", () => {
      const rule = createSafeRule({ name: "Test", domains: ["example.com"], priority: 5 })
      expect(rule.priority).toBe(5)
    })

    it("should default priority to 1 for invalid values", () => {
      const rule = createSafeRule({ name: "Test", domains: ["example.com"], priority: -1 })
      expect(rule.priority).toBe(1)
    })

    it("should handle empty name", () => {
      const rule = createSafeRule({ name: "", domains: ["example.com"] })
      expect(rule.name).toBe("Unnamed Rule")
    })
  })
})
