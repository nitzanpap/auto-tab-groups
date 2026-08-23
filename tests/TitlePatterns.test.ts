import { describe, expect, it } from "vitest"
import { urlPatternMatcher } from "../utils/UrlPatternMatcher"

/**
 * Rules that match the page title instead of the URL (#98).
 *
 * A pattern prefixed with "title:" is matched against the tab's title. The
 * text has to appear in the title and "*" stands for anything.
 */
describe("Title patterns", () => {
  const url = "https://www.youtube.com/watch?v=abc123"
  const title = "How the Sahara Was Green - Barely Sociable - YouTube"

  describe("matching", () => {
    it("should match text appearing anywhere in the title", () => {
      const result = urlPatternMatcher.match(url, "title:Barely Sociable", {
        title,
        ruleName: "Barely Sociable"
      })

      expect(result.matched).toBe(true)
      expect(result.groupName).toBe("Barely Sociable")
    })

    it("should ignore case", () => {
      const result = urlPatternMatcher.match(url, "title:barely sociable", { title })
      expect(result.matched).toBe(true)
    })

    it("should support * for anything", () => {
      const result = urlPatternMatcher.match(url, "title:Sahara*YouTube", { title })
      expect(result.matched).toBe(true)
    })

    it("should not match a title without the text", () => {
      const result = urlPatternMatcher.match(url, "title:Barely Sociable", {
        title: "Rick Astley - Never Gonna Give You Up - YouTube"
      })
      expect(result.matched).toBe(false)
    })

    it("should not match when the tab has no title", () => {
      const result = urlPatternMatcher.match(url, "title:Barely Sociable", {})
      expect(result.matched).toBe(false)
    })

    it("should not look at the URL", () => {
      const result = urlPatternMatcher.match("https://example.com", "title:example.com", {
        title: "Something else"
      })
      expect(result.matched).toBe(false)
    })

    it("should accept the prefix in any case", () => {
      const result = urlPatternMatcher.match(url, "Title:Barely Sociable", { title })
      expect(result.matched).toBe(true)
    })
  })

  describe("naming the group", () => {
    it("should name the group after the rule", () => {
      const result = urlPatternMatcher.match(url, "title:*YouTube", {
        title,
        ruleName: "Videos"
      })
      expect(result.groupName).toBe("Videos")
    })

    it("should treat braces as literal text", () => {
      const withBraces = urlPatternMatcher.match(url, "title:{channel} - YouTube", { title })
      expect(withBraces.matched).toBe(false)

      const literal = urlPatternMatcher.match(url, "title:{draft}", {
        title: "{draft} My notes",
        ruleName: "Drafts"
      })
      expect(literal.matched).toBe(true)
      expect(literal.groupName).toBe("Drafts")
    })
  })

  describe("validation", () => {
    it("should accept a title pattern", () => {
      const result = urlPatternMatcher.validatePattern("title:{channel} - YouTube")
      expect(result.isValid).toBe(true)
    })

    it("should accept characters a URL pattern would reject", () => {
      const result = urlPatternMatcher.validatePattern("title:Q&A (2026) — live!")
      expect(result.isValid).toBe(true)
    })

    it("should reject an empty title pattern", () => {
      const result = urlPatternMatcher.validatePattern("title:")
      expect(result.isValid).toBe(false)
    })
  })
})
