import { describe, expect, it } from "vitest"
import { urlPatternMatcher } from "../utils/UrlPatternMatcher"

/**
 * Patterns that address a query string (#98).
 *
 * The reporter wanted to group YouTube tabs by channel using the
 * `ab_channel=` parameter a userscript adds to the URL.
 */
describe("Query string patterns", () => {
  const channelLast = "https://www.youtube.com/watch?v=abc123&ab_channel=BarelySociable"
  const channelFirst = "https://www.youtube.com/watch?ab_channel=BarelySociable&v=abc123"
  const noChannel = "https://www.youtube.com/watch?v=abc123"

  describe("a query written straight after the host", () => {
    it("should be a valid pattern", () => {
      const result = urlPatternMatcher.validatePattern("youtube.com?ab_channel=BarelySociable")
      expect(result.isValid).toBe(true)
    })

    it("should match whatever the parameter order is", () => {
      const pattern = "youtube.com?ab_channel=BarelySociable"

      for (const url of [channelLast, channelFirst]) {
        const result = urlPatternMatcher.match(url, pattern, {
          ruleName: "Barely Sociable",
          allowAutoSubdomain: true
        })
        expect(result.matched).toBe(true)
      }
    })

    it("should not match a URL without the parameter", () => {
      const result = urlPatternMatcher.match(noChannel, "youtube.com?ab_channel=BarelySociable", {
        ruleName: "Barely Sociable",
        allowAutoSubdomain: true
      })
      expect(result.matched).toBe(false)
    })

    it("should still reject a host with invalid characters", () => {
      const result = urlPatternMatcher.validatePattern("you<tube>.com?a=b")
      expect(result.isValid).toBe(false)
    })
  })

  describe("extracting a value from the query", () => {
    it("should stop the capture at the next parameter", () => {
      const result = urlPatternMatcher.match(
        channelFirst,
        "*.youtube.com/watch?*ab_channel={channel}"
      )

      expect(result.matched).toBe(true)
      expect(result.extractedValues.channel).toBe("BarelySociable")
      expect(result.groupName).toBe("BarelySociable")
    })

    it("should still capture a parameter that ends the query", () => {
      const result = urlPatternMatcher.match(
        channelLast,
        "*.youtube.com/watch?*ab_channel={channel}"
      )

      expect(result.matched).toBe(true)
      expect(result.groupName).toBe("BarelySociable")
    })

    it("should stop the capture at a hash", () => {
      const result = urlPatternMatcher.match(
        "https://www.youtube.com/watch?ab_channel=BarelySociable#t=30",
        "*.youtube.com/watch?*ab_channel={channel}"
      )

      expect(result.groupName).toBe("BarelySociable")
    })

    it("should match a bare host the way wildcard patterns do", () => {
      // Rules retry with allowAutoSubdomain, so "youtube.com" has to reach
      // "www.youtube.com" here as well — the wildcard matcher already does
      const result = urlPatternMatcher.match(
        channelLast,
        "youtube.com/watch?*ab_channel={channel}",
        {
          allowAutoSubdomain: true
        }
      )

      expect(result.matched).toBe(true)
      expect(result.groupName).toBe("BarelySociable")
    })

    it("should not auto-match a subdomain when the option is off", () => {
      const result = urlPatternMatcher.match(channelLast, "youtube.com/watch?*ab_channel={channel}")

      expect(result.matched).toBe(false)
    })
  })
})
