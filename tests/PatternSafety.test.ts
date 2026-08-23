import { afterEach, describe, expect, it, vi } from "vitest"
import { urlPatternMatcher } from "../utils/UrlPatternMatcher"

/**
 * A pattern's cost must not depend on who wrote it.
 *
 * Rules are not only typed into the editor — they import from a JSON file, so
 * a shared rules pack is untrusted input that becomes a matcher. Every pattern
 * type used to compile to a regex that backtracks exponentially: twenty
 * wildcards against a sixty-character URL took over a minute in a single
 * match, with the service worker blocked for all of it, on every tab update.
 */
describe("Pattern safety", () => {
  const HOSTILE = "*a".repeat(20)
  const url = `https://example.com/${"a".repeat(60)}X`
  const BUDGET_MS = 100

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function timed(fn: () => unknown): number {
    const started = performance.now()
    fn()
    return performance.now() - started
  }

  describe("wildcard patterns", () => {
    it("should match a hostile path pattern quickly", () => {
      const elapsed = timed(() => urlPatternMatcher.match(url, `example.com/${HOSTILE}b`))
      expect(elapsed).toBeLessThan(BUDGET_MS)
    })

    it("should match a hostile domain pattern quickly", () => {
      const elapsed = timed(() =>
        urlPatternMatcher.match(`https://${"a".repeat(50)}X.com/x`, `${HOSTILE}b.com`)
      )
      expect(elapsed).toBeLessThan(BUDGET_MS)
    })

    it("should match a hostile title pattern quickly", () => {
      const elapsed = timed(() =>
        urlPatternMatcher.match(url, `title:${HOSTILE}b`, { title: `${"a".repeat(60)}X` })
      )
      expect(elapsed).toBeLessThan(BUDGET_MS)
    })

    it("should still match the patterns people actually write", () => {
      expect(
        urlPatternMatcher.match("https://docs.google.com/forms", "*.google.com/forms").matched
      ).toBe(true)
      expect(
        urlPatternMatcher.match("https://site.com/a/b/admin", "site.com/**/admin").matched
      ).toBe(true)
      expect(urlPatternMatcher.match("https://site.com/api/v2", "site.com/api/*").matched).toBe(
        true
      )
      expect(urlPatternMatcher.match("https://site.com/other", "site.com/api/*").matched).toBe(
        false
      )
    })
  })

  describe("extraction patterns", () => {
    it("should refuse a pattern with too many wildcards", () => {
      const result = urlPatternMatcher.validatePattern(`example.com/${HOSTILE}{id}b`)

      expect(result.isValid).toBe(false)
      expect(result.error).toContain("too many wildcards")
    })

    it("should keep accepting the patterns people actually write", () => {
      for (const pattern of [
        "*.reddit.com/r/{subreddit}/comments/*",
        "site.com/?ticket={ticket}",
        "app.io/directory/#/{section}"
      ]) {
        expect(urlPatternMatcher.validatePattern(pattern).isValid).toBe(true)
      }
    })

    it("should stay quick at the limit", () => {
      const atLimit = `example.com/${"*a".repeat(3)}{id}b`
      expect(urlPatternMatcher.validatePattern(atLimit).isValid).toBe(true)
      expect(timed(() => urlPatternMatcher.match(url, atLimit))).toBeLessThan(BUDGET_MS)
    })
  })

  describe("regex patterns", () => {
    it("should refuse a regex that backtracks catastrophically", () => {
      for (const pattern of ["/(a+)+$/", "/^(a|a)+$/", "/(a*)*$/"]) {
        const result = urlPatternMatcher.validatePattern(pattern)
        expect(result.isValid).toBe(false)
        expect(result.error).toContain("too slow")
      }
    })

    it("should accept a regex that behaves", () => {
      const pattern = "/ab_channel=([a-z0-9]+)/"

      expect(urlPatternMatcher.validatePattern(pattern).isValid).toBe(true)
      expect(
        urlPatternMatcher.match("https://youtube.com/watch?ab_channel=barely", pattern).groupName
      ).toBe("barely")
    })

    it("should skip a regex that turns out to be slow anyway", () => {
      const pattern = "/example\\.com/"
      const url = "https://example.com/page"

      // A rule saved before this check existed, or slow only on certain URLs:
      // fake the clock so one match looks expensive without waiting for it
      let call = 0
      vi.spyOn(performance, "now").mockImplementation(() => (call++ === 0 ? 0 : 1000))

      expect(urlPatternMatcher.match(url, pattern).matched).toBe(true)

      vi.restoreAllMocks()

      // ...and from then on that pattern is left out of matching entirely
      expect(urlPatternMatcher.match(url, pattern).matched).toBe(false)
    })
  })
})
