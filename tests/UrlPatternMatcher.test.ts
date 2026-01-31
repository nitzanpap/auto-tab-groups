import { describe, expect, it } from "vitest"
import type { PatternType } from "../utils/UrlPatternMatcher"
import { PATTERN_TYPES, urlPatternMatcher } from "../utils/UrlPatternMatcher"

describe("UrlPatternMatcher", () => {
  describe("detectPatternType", () => {
    it("should detect simple wildcard pattern (no special syntax)", () => {
      expect(urlPatternMatcher.detectPatternType("*.example.com")).toBe(
        PATTERN_TYPES.SIMPLE_WILDCARD
      )
    })

    it("should detect segment extraction pattern", () => {
      expect(urlPatternMatcher.detectPatternType("{subdomain}.example.com")).toBe(
        PATTERN_TYPES.SEGMENT_EXTRACTION
      )
    })

    it("should detect regex pattern", () => {
      expect(urlPatternMatcher.detectPatternType("/example\\.com/")).toBe(PATTERN_TYPES.REGEX)
    })

    it("should default to simple wildcard for plain domain", () => {
      expect(urlPatternMatcher.detectPatternType("example.com")).toBe(PATTERN_TYPES.SIMPLE_WILDCARD)
    })
  })

  describe("match - simple wildcard", () => {
    it("should match exact domain", () => {
      const result = urlPatternMatcher.match("https://example.com", "example.com")
      expect(result.matched).toBe(true)
    })

    it("should match domain with www", () => {
      const result = urlPatternMatcher.match("https://www.example.com", "www.example.com")
      expect(result.matched).toBe(true)
    })

    it("should match wildcard subdomain", () => {
      const result = urlPatternMatcher.match("https://blog.example.com", "*.example.com")
      expect(result.matched).toBe(true)
    })

    it("should match wildcard subdomain with www", () => {
      const result = urlPatternMatcher.match("https://www.example.com", "*.example.com")
      expect(result.matched).toBe(true)
    })

    it("should not match different domain", () => {
      const result = urlPatternMatcher.match("https://different.com", "example.com")
      expect(result.matched).toBe(false)
    })

    it("should return group name from options", () => {
      const result = urlPatternMatcher.match("https://example.com", "example.com", {
        ruleName: "My Rule"
      })
      expect(result.matched).toBe(true)
      expect(result.groupName).toBe("My Rule")
    })

    it("should handle URL with path", () => {
      const result = urlPatternMatcher.match("https://example.com/path/to/page", "example.com")
      expect(result.matched).toBe(true)
    })

    it("should handle URL with query string", () => {
      const result = urlPatternMatcher.match("https://example.com?foo=bar", "example.com")
      expect(result.matched).toBe(true)
    })

    it("should handle empty URL", () => {
      const result = urlPatternMatcher.match("", "example.com")
      expect(result.matched).toBe(false)
    })

    it("should handle empty pattern", () => {
      const result = urlPatternMatcher.match("https://example.com", "")
      expect(result.matched).toBe(false)
    })

    it("should be case-insensitive", () => {
      const result = urlPatternMatcher.match("https://EXAMPLE.COM", "example.com")
      expect(result.matched).toBe(true)
    })
  })

  describe("match - segment extraction", () => {
    it("should extract subdomain", () => {
      const result = urlPatternMatcher.match("https://blog.example.com", "{subdomain}.example.com")
      expect(result.matched).toBe(true)
      expect(result.extractedValues.subdomain).toBe("blog")
    })

    it("should extract and use in group name", () => {
      const result = urlPatternMatcher.match(
        "https://blog.example.com",
        "{subdomain}.example.com",
        {
          ruleName: "Example Sites"
        }
      )
      expect(result.matched).toBe(true)
      expect(result.extractedValues.subdomain).toBe("blog")
    })

    it("should extract multiple segments", () => {
      const result = urlPatternMatcher.match(
        "https://user.blog.example.com",
        "{user}.{section}.example.com"
      )
      expect(result.matched).toBe(true)
      expect(result.extractedValues.user).toBe("user")
      expect(result.extractedValues.section).toBe("blog")
    })

    it("should not match if segments dont align", () => {
      const result = urlPatternMatcher.match("https://example.com", "{subdomain}.example.com")
      expect(result.matched).toBe(false)
    })
  })

  describe("match - regex patterns", () => {
    it("should match with regex pattern", () => {
      const result = urlPatternMatcher.match("https://example.com", "/example\\.com/")
      expect(result.matched).toBe(true)
    })

    it("should not match with non-matching regex", () => {
      const result = urlPatternMatcher.match("https://different.com", "/example\\.com/")
      expect(result.matched).toBe(false)
    })

    it("should handle regex with character class", () => {
      const result = urlPatternMatcher.match(
        "https://test123.example.com",
        "/test[0-9]+\\.example\\.com/"
      )
      expect(result.matched).toBe(true)
    })
  })

  describe("validatePattern", () => {
    it("should validate simple domain pattern", () => {
      const result = urlPatternMatcher.validatePattern("example.com")
      expect(result.isValid).toBe(true)
    })

    it("should validate wildcard pattern", () => {
      const result = urlPatternMatcher.validatePattern("*.example.com")
      expect(result.isValid).toBe(true)
    })

    it("should validate segment extraction pattern", () => {
      const result = urlPatternMatcher.validatePattern("{subdomain}.example.com")
      expect(result.isValid).toBe(true)
    })

    it("should reject empty pattern", () => {
      const result = urlPatternMatcher.validatePattern("")
      expect(result.isValid).toBe(false)
    })

    it("should reject pattern with only whitespace", () => {
      const result = urlPatternMatcher.validatePattern("   ")
      expect(result.isValid).toBe(false)
    })

    it("should reject null pattern", () => {
      const result = urlPatternMatcher.validatePattern(null as unknown as string)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Pattern must be a non-empty string")
    })

    it("should reject pattern exceeding max length", () => {
      const longPattern = "a".repeat(501)
      const result = urlPatternMatcher.validatePattern(longPattern)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Pattern too long (max 500 characters)")
    })

    it("should reject pattern with too many asterisks", () => {
      const result = urlPatternMatcher.validatePattern("***.example.com")
      expect(result.isValid).toBe(false)
      expect(result.error).toContain("too many asterisks")
    })

    it("should reject domain pattern with invalid characters", () => {
      const result = urlPatternMatcher.validatePattern("example<script>.com")
      expect(result.isValid).toBe(false)
      expect(result.error).toContain("invalid characters")
    })

    it("should reject path pattern with invalid characters", () => {
      const result = urlPatternMatcher.validatePattern("example.com/<script>")
      expect(result.isValid).toBe(false)
      expect(result.error).toContain("invalid characters")
    })

    it("should validate pattern with path", () => {
      const result = urlPatternMatcher.validatePattern("example.com/api/*")
      expect(result.isValid).toBe(true)
    })

    it("should validate regex pattern", () => {
      const result = urlPatternMatcher.validatePattern("/example\\.com/")
      expect(result.isValid).toBe(true)
      expect(result.type).toBe(PATTERN_TYPES.REGEX)
    })

    it("should reject empty regex pattern", () => {
      const result = urlPatternMatcher.validatePattern("//")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Regex pattern cannot be empty")
    })

    it("should reject invalid regex pattern", () => {
      const result = urlPatternMatcher.validatePattern("/[invalid/")
      expect(result.isValid).toBe(false)
      expect(result.error).toContain("Invalid regex")
    })

    it("should reject segment pattern with duplicate variable names", () => {
      const result = urlPatternMatcher.validatePattern("{sub}.{sub}.example.com")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Duplicate variable names in pattern")
    })

    it("should reject segment pattern with invalid variable name", () => {
      const result = urlPatternMatcher.validatePattern("{123invalid}.example.com")
      expect(result.isValid).toBe(false)
      expect(result.error).toContain("Invalid variable name")
    })

    it("should reject pattern with no variables (just open brace)", () => {
      // Pattern with { but no closing } is treated as simple wildcard with invalid chars
      const result = urlPatternMatcher.validatePattern("{unclosed.example.com")
      expect(result.isValid).toBe(false)
    })
  })

  describe("match - TLD wildcard (double asterisk)", () => {
    it("should match google.** with google.com", () => {
      const result = urlPatternMatcher.match("https://google.com", "google.**")
      expect(result.matched).toBe(true)
    })

    it("should match google.** with google.co.uk", () => {
      const result = urlPatternMatcher.match("https://google.co.uk", "google.**")
      expect(result.matched).toBe(true)
    })

    it("should not match google.** with notgoogle.com", () => {
      const result = urlPatternMatcher.match("https://notgoogle.com", "google.**")
      expect(result.matched).toBe(false)
    })

    it("should not match combined *.** pattern (not supported)", () => {
      // Combined * and ** patterns are complex and not fully supported
      const result = urlPatternMatcher.match("https://mail.google.com", "*.google.**")
      expect(result.matched).toBe(false)
    })
  })

  describe("match - middle wildcard", () => {
    it("should match middle wildcard pattern", () => {
      const result = urlPatternMatcher.match(
        "https://prefix-test.example.com",
        "prefix-*.example.com"
      )
      expect(result.matched).toBe(true)
    })

    it("should not match middle wildcard with wrong suffix", () => {
      const result = urlPatternMatcher.match(
        "https://prefix-test.other.com",
        "prefix-*.example.com"
      )
      expect(result.matched).toBe(false)
    })
  })

  describe("match - path patterns", () => {
    it("should match URL with path pattern", () => {
      const result = urlPatternMatcher.match("https://example.com/api/users", "example.com/api")
      expect(result.matched).toBe(true)
    })

    it("should not match URL with wrong path", () => {
      const result = urlPatternMatcher.match("https://example.com/other/users", "example.com/api")
      expect(result.matched).toBe(false)
    })

    it("should match path with ** wildcard", () => {
      const result = urlPatternMatcher.match(
        "https://example.com/api/v1/users",
        "example.com/api/**/users"
      )
      expect(result.matched).toBe(true)
    })
  })

  describe("match - comprehensive path patterns", () => {
    // Basic path patterns
    it("should match URL with exact path prefix", () => {
      const result = urlPatternMatcher.match("https://example.com/api/users", "example.com/api")
      expect(result.matched).toBe(true)
    })

    it("should match URL with path and query string", () => {
      const result = urlPatternMatcher.match("https://example.com/api?key=123", "example.com/api")
      expect(result.matched).toBe(true)
    })

    it("should NOT match URL with different path", () => {
      const result = urlPatternMatcher.match("https://example.com/admin", "example.com/api")
      expect(result.matched).toBe(false)
    })

    // Deep path patterns
    it("should match deep path patterns", () => {
      const result = urlPatternMatcher.match(
        "https://example.com/api/v2/users/123",
        "example.com/api/v2"
      )
      expect(result.matched).toBe(true)
    })

    it("should match exact deep path", () => {
      const result = urlPatternMatcher.match(
        "https://example.com/admin/settings/profile",
        "example.com/admin/settings"
      )
      expect(result.matched).toBe(true)
    })

    // Wildcard in path
    it("should match path with single wildcard segment", () => {
      const result = urlPatternMatcher.match(
        "https://example.com/users/john/profile",
        "example.com/users/*/profile"
      )
      expect(result.matched).toBe(true)
    })

    it("should match path with multiple segments after wildcard", () => {
      const result = urlPatternMatcher.match(
        "https://example.com/a/b/c/d/target",
        "example.com/**/target"
      )
      expect(result.matched).toBe(true)
    })

    // Real-world examples from user feedback
    it("should match google.com/ai path (user feedback row 284)", () => {
      const result = urlPatternMatcher.match("https://google.com/ai/studio", "google.com/ai")
      expect(result.matched).toBe(true)
    })

    it("should match google.com/ai with deep path", () => {
      const result = urlPatternMatcher.match("https://google.com/ai/gemini/app", "google.com/ai")
      expect(result.matched).toBe(true)
    })

    it("should match reddit.com/r/subreddit path with wildcard (user feedback row 284)", () => {
      // Note: Use *.reddit.com to match www.reddit.com
      const result = urlPatternMatcher.match(
        "https://www.reddit.com/r/runescape/comments/123",
        "*.reddit.com/r/runescape"
      )
      expect(result.matched).toBe(true)
    })

    it("should match reddit.com path without www", () => {
      const result = urlPatternMatcher.match(
        "https://reddit.com/r/runescape/comments/123",
        "reddit.com/r/runescape"
      )
      expect(result.matched).toBe(true)
    })

    it("should NOT match reddit.com with different subreddit", () => {
      const result = urlPatternMatcher.match(
        "https://www.reddit.com/r/gaming/comments/123",
        "*.reddit.com/r/runescape"
      )
      expect(result.matched).toBe(false)
    })

    // GitHub paths
    it("should match github.com/user/repo path", () => {
      const result = urlPatternMatcher.match(
        "https://github.com/nitzanpap/auto-tab-groups/issues",
        "github.com/nitzanpap/auto-tab-groups"
      )
      expect(result.matched).toBe(true)
    })

    // AWS Console paths
    it("should match AWS console paths", () => {
      const result = urlPatternMatcher.match(
        "https://console.aws.amazon.com/ec2/home?region=us-east-1",
        "console.aws.amazon.com/ec2"
      )
      expect(result.matched).toBe(true)
    })

    // Path with hash/fragment
    it("should match URL with hash fragment", () => {
      const result = urlPatternMatcher.match(
        "https://example.com/docs/api#section",
        "example.com/docs"
      )
      expect(result.matched).toBe(true)
    })

    // Edge cases
    it("should handle trailing slash in URL", () => {
      const result = urlPatternMatcher.match("https://example.com/api/", "example.com/api")
      expect(result.matched).toBe(true)
    })

    it("should handle trailing slash in pattern", () => {
      const result = urlPatternMatcher.match("https://example.com/api/users", "example.com/api/")
      expect(result.matched).toBe(true)
    })
  })

  describe("match - segment extraction with path", () => {
    it("should extract from URL with path", () => {
      const result = urlPatternMatcher.match(
        "https://user123.example.com/dashboard",
        "{user}.example.com/dashboard"
      )
      expect(result.matched).toBe(true)
      expect(result.extractedValues.user).toBe("user123")
    })
  })

  describe("match - regex with groups", () => {
    it("should extract groups from regex pattern", () => {
      const result = urlPatternMatcher.match(
        "https://user123.example.com",
        "/(\\w+)\\.example\\.com/"
      )
      expect(result.matched).toBe(true)
      expect(result.extractedValues.group1).toBe("user123")
    })

    it("should use first group as group name", () => {
      const result = urlPatternMatcher.match(
        "https://myproject.example.com",
        "/(\\w+)\\.example\\.com/"
      )
      expect(result.matched).toBe(true)
      expect(result.groupName).toBe("myproject")
    })
  })

  describe("match - group name generation", () => {
    it("should use groupNameTemplate when provided", () => {
      const result = urlPatternMatcher.match("https://blog.example.com", "{section}.example.com", {
        groupNameTemplate: "Site: {section}"
      })
      expect(result.matched).toBe(true)
      expect(result.groupName).toBe("Site: blog")
    })

    it("should fall back to ruleName when no template", () => {
      const result = urlPatternMatcher.match("https://example.com", "example.com", {
        ruleName: "My Rule"
      })
      expect(result.matched).toBe(true)
      expect(result.groupName).toBe("My Rule")
    })
  })

  describe("match - edge cases", () => {
    it("should handle invalid URL gracefully", () => {
      const result = urlPatternMatcher.match("not-a-url", "example.com")
      expect(result.matched).toBe(false)
    })

    it("should handle empty domain pattern part", () => {
      const result = urlPatternMatcher.match("https://example.com", "/path")
      expect(result.matched).toBe(false)
    })

    it("should handle regex pattern error", () => {
      const result = urlPatternMatcher.match("https://example.com", "/[/")
      expect(result.matched).toBe(false)
    })

    it("should handle segment extraction with invalid URL", () => {
      const result = urlPatternMatcher.match("not-a-url", "{sub}.example.com")
      expect(result.matched).toBe(false)
    })
  })

  describe("matchDomainWildcard - edge cases", () => {
    it("should return false for empty domain", () => {
      const result = urlPatternMatcher.matchDomainWildcard("", "example.com")
      expect(result).toBe(false)
    })

    it("should return false for empty pattern", () => {
      const result = urlPatternMatcher.matchDomainWildcard("example.com", "")
      expect(result).toBe(false)
    })

    it("should handle ** pattern with suffix", () => {
      const result = urlPatternMatcher.matchDomainWildcard("google.co.uk", "google.**")
      expect(result).toBe(true)
    })

    it("should handle ** pattern with non-matching prefix", () => {
      const result = urlPatternMatcher.matchDomainWildcard("notgoogle.com", "google.**")
      expect(result).toBe(false)
    })
  })

  describe("matchPathWildcard - edge cases", () => {
    it("should return true for empty pattern", () => {
      const result = urlPatternMatcher.matchPathWildcard("/api/users", "")
      expect(result).toBe(true)
    })

    it("should handle leading slash in path and pattern", () => {
      const result = urlPatternMatcher.matchPathWildcard("/api/users", "/api")
      expect(result).toBe(true)
    })

    it("should return false for invalid ** pattern parts", () => {
      const result = urlPatternMatcher.matchPathWildcard("/a/b/c", "x**y**z")
      expect(result).toBe(false)
    })
  })

  describe("getPatternTypeDisplayName", () => {
    it("should return display name for simple wildcard", () => {
      expect(urlPatternMatcher.getPatternTypeDisplayName(PATTERN_TYPES.SIMPLE_WILDCARD)).toBe(
        "Simple Wildcard"
      )
    })

    it("should return display name for segment extraction", () => {
      expect(urlPatternMatcher.getPatternTypeDisplayName(PATTERN_TYPES.SEGMENT_EXTRACTION)).toBe(
        "Segment Extraction"
      )
    })

    it("should return display name for regex", () => {
      expect(urlPatternMatcher.getPatternTypeDisplayName(PATTERN_TYPES.REGEX)).toBe(
        "Regular Expression"
      )
    })

    it("should handle unknown type", () => {
      expect(urlPatternMatcher.getPatternTypeDisplayName("unknown" as PatternType)).toBe(
        "Simple Wildcard"
      )
    })
  })

  describe("getPatternHelp", () => {
    it("should return help for simple wildcard", () => {
      const help = urlPatternMatcher.getPatternHelp(PATTERN_TYPES.SIMPLE_WILDCARD)
      expect(help).toContain("*")
      expect(help).toContain("**")
    })

    it("should return help for segment extraction", () => {
      const help = urlPatternMatcher.getPatternHelp(PATTERN_TYPES.SEGMENT_EXTRACTION)
      expect(help).toContain("{variable}")
    })

    it("should return help for regex", () => {
      const help = urlPatternMatcher.getPatternHelp(PATTERN_TYPES.REGEX)
      expect(help).toContain("regex")
    })

    it("should handle unknown type", () => {
      const help = urlPatternMatcher.getPatternHelp("unknown" as PatternType)
      expect(help).toContain("*")
    })
  })

  describe("parseVariableSpec", () => {
    it("should parse variable with default type", () => {
      // Test internal method through segment extraction
      const result = urlPatternMatcher.match("https://testuser.example.com", "{user}.example.com")
      expect(result.matched).toBe(true)
      expect(result.extractedValues.user).toBe("testuser")
    })
  })

  describe("buildSegmentRegex - delimiter types", () => {
    it("should handle dash delimiter", () => {
      const result = urlPatternMatcher.match(
        "https://prefix-value.example.com",
        "prefix-{val:segment:dash}.example.com"
      )
      expect(result.matched).toBe(true)
      expect(result.extractedValues.val).toBe("value")
    })

    it("should handle dot delimiter", () => {
      const result = urlPatternMatcher.match(
        "https://value.region.example.com",
        "{val:segment:dot}.{region}.example.com"
      )
      expect(result.matched).toBe(true)
    })
  })

  describe("auto-subdomain matching", () => {
    it("should NOT auto-match subdomain by default", () => {
      const result = urlPatternMatcher.match("https://www.example.com", "example.com")
      expect(result.matched).toBe(false)
    })

    it("should auto-match www subdomain when allowAutoSubdomain is true", () => {
      const result = urlPatternMatcher.match("https://www.example.com", "example.com", {
        allowAutoSubdomain: true
      })
      expect(result.matched).toBe(true)
    })

    it("should auto-match language subdomain when allowAutoSubdomain is true", () => {
      const result = urlPatternMatcher.match("https://he.aliexpress.com", "aliexpress.com", {
        allowAutoSubdomain: true
      })
      expect(result.matched).toBe(true)
    })

    it("should auto-match mobile subdomain when allowAutoSubdomain is true", () => {
      const result = urlPatternMatcher.match("https://m.facebook.com", "facebook.com", {
        allowAutoSubdomain: true
      })
      expect(result.matched).toBe(true)
    })

    it("should auto-match deep subdomains when allowAutoSubdomain is true", () => {
      const result = urlPatternMatcher.match("https://api.v2.service.com", "service.com", {
        allowAutoSubdomain: true
      })
      expect(result.matched).toBe(true)
    })

    it("should still match exact domain when allowAutoSubdomain is true", () => {
      const result = urlPatternMatcher.match("https://example.com", "example.com", {
        allowAutoSubdomain: true
      })
      expect(result.matched).toBe(true)
    })

    it("should NOT auto-match subdomain when allowAutoSubdomain is false", () => {
      const result = urlPatternMatcher.match("https://www.example.com", "example.com", {
        allowAutoSubdomain: false
      })
      expect(result.matched).toBe(false)
    })

    it("should auto-match subdomain for domain with path", () => {
      const result = urlPatternMatcher.match("https://www.example.com/page", "example.com/page", {
        allowAutoSubdomain: true
      })
      expect(result.matched).toBe(true)
    })

    it("should match explicit subdomain pattern exactly without auto-subdomain", () => {
      const result = urlPatternMatcher.match("https://he.aliexpress.com", "he.aliexpress.com", {
        allowAutoSubdomain: false
      })
      expect(result.matched).toBe(true)
    })
  })
})
