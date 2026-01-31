import { describe, expect, it } from "vitest"
import type { Browser } from "wxt/browser"

import { contextMenuService } from "../services/ContextMenuService"

// Helper to create mock tabs with just the url property
function createMockTabs(urls: (string | undefined)[]): Browser.tabs.Tab[] {
  return urls.map(url => ({ url }) as unknown as Browser.tabs.Tab)
}

describe("ContextMenuService", () => {
  describe("extractUniqueDomains", () => {
    it("should extract unique domains from tabs", () => {
      const tabs = createMockTabs([
        "https://amazon.com/product/123",
        "https://ebay.com/item/456",
        "https://amazon.com/cart"
      ])

      const domains = contextMenuService.extractUniqueDomains(tabs)

      expect(domains).toHaveLength(2)
      expect(domains).toContain("amazon.com")
      expect(domains).toContain("ebay.com")
    })

    it("should return sorted domains", () => {
      const tabs = createMockTabs(["https://zebra.com", "https://amazon.com", "https://ebay.com"])

      const domains = contextMenuService.extractUniqueDomains(tabs)

      expect(domains).toEqual(["amazon.com", "ebay.com", "zebra.com"])
    })

    it("should skip tabs without URLs", () => {
      const tabs = createMockTabs(["https://amazon.com", undefined, "", "https://ebay.com"])

      const domains = contextMenuService.extractUniqueDomains(tabs)

      expect(domains).toHaveLength(2)
      expect(domains).toContain("amazon.com")
      expect(domains).toContain("ebay.com")
    })

    it("should skip system URLs (chrome://, about:, etc)", () => {
      const tabs = createMockTabs([
        "https://amazon.com",
        "chrome://settings",
        "about:blank",
        "chrome-extension://abc123/popup.html",
        "https://ebay.com"
      ])

      const domains = contextMenuService.extractUniqueDomains(tabs)

      expect(domains).toHaveLength(2)
      expect(domains).toContain("amazon.com")
      expect(domains).toContain("ebay.com")
    })

    it("should handle subdomains by extracting base domain", () => {
      const tabs = createMockTabs([
        "https://www.amazon.com",
        "https://smile.amazon.com",
        "https://api.amazon.com"
      ])

      const domains = contextMenuService.extractUniqueDomains(tabs)

      expect(domains).toHaveLength(1)
      expect(domains).toContain("amazon.com")
    })

    it("should handle country code SLDs correctly", () => {
      const tabs = createMockTabs([
        "https://www.bbc.co.uk",
        "https://news.bbc.co.uk",
        "https://www.abc.com.au"
      ])

      const domains = contextMenuService.extractUniqueDomains(tabs)

      expect(domains).toHaveLength(2)
      expect(domains).toContain("bbc.co.uk")
      expect(domains).toContain("abc.com.au")
    })

    it("should return empty array for empty tabs array", () => {
      const domains = contextMenuService.extractUniqueDomains([])
      expect(domains).toEqual([])
    })

    it("should return empty array if all tabs have invalid URLs", () => {
      const tabs = createMockTabs(["chrome://settings", "about:blank", undefined])

      const domains = contextMenuService.extractUniqueDomains(tabs)

      expect(domains).toEqual([])
    })

    it("should handle mixed valid and invalid URLs", () => {
      const tabs = createMockTabs([
        "https://amazon.com",
        "not-a-valid-url",
        "https://ebay.com",
        "file:///local/path"
      ])

      const domains = contextMenuService.extractUniqueDomains(tabs)

      expect(domains).toHaveLength(2)
      expect(domains).toContain("amazon.com")
      expect(domains).toContain("ebay.com")
    })
  })

  describe("extractFullUrls", () => {
    it("should extract URL patterns from tabs (strips protocol)", () => {
      const tabs = createMockTabs([
        "https://amazon.com/product/123",
        "https://ebay.com/item/456",
        "https://amazon.com/cart"
      ])

      const urls = contextMenuService.extractFullUrls(tabs)

      expect(urls).toHaveLength(3)
      expect(urls).toContain("amazon.com/product/123")
      expect(urls).toContain("ebay.com/item/456")
      expect(urls).toContain("amazon.com/cart")
    })

    it("should return sorted URL patterns", () => {
      const tabs = createMockTabs([
        "https://zebra.com/page",
        "https://amazon.com/product",
        "https://ebay.com/item"
      ])

      const urls = contextMenuService.extractFullUrls(tabs)

      expect(urls).toEqual(["amazon.com/product", "ebay.com/item", "zebra.com/page"])
    })

    it("should skip tabs without URLs", () => {
      const tabs = createMockTabs([
        "https://amazon.com/page",
        undefined,
        "",
        "https://ebay.com/item"
      ])

      const urls = contextMenuService.extractFullUrls(tabs)

      expect(urls).toHaveLength(2)
      expect(urls).toContain("amazon.com/page")
      expect(urls).toContain("ebay.com/item")
    })

    it("should skip system URLs (chrome://, about:, etc)", () => {
      const tabs = createMockTabs([
        "https://amazon.com/page",
        "chrome://settings",
        "about:blank",
        "chrome-extension://abc123/popup.html",
        "edge://settings",
        "moz-extension://xyz/popup.html",
        "https://ebay.com/item"
      ])

      const urls = contextMenuService.extractFullUrls(tabs)

      expect(urls).toHaveLength(2)
      expect(urls).toContain("amazon.com/page")
      expect(urls).toContain("ebay.com/item")
    })

    it("should preserve path, query params and fragments (without protocol)", () => {
      const tabs = createMockTabs([
        "https://example.com/search?q=test&page=1",
        "https://example.com/docs#section-2"
      ])

      const urls = contextMenuService.extractFullUrls(tabs)

      expect(urls).toHaveLength(2)
      expect(urls).toContain("example.com/search?q=test&page=1")
      expect(urls).toContain("example.com/docs#section-2")
    })

    it("should return empty array for empty tabs array", () => {
      const urls = contextMenuService.extractFullUrls([])
      expect(urls).toEqual([])
    })

    it("should return empty array if all tabs have system URLs", () => {
      const tabs = createMockTabs([
        "chrome://settings",
        "about:blank",
        "chrome-extension://abc/popup.html"
      ])

      const urls = contextMenuService.extractFullUrls(tabs)

      expect(urls).toEqual([])
    })

    it("should deduplicate identical URL patterns", () => {
      const tabs = createMockTabs([
        "https://amazon.com/page",
        "https://amazon.com/page",
        "https://ebay.com/item"
      ])

      const urls = contextMenuService.extractFullUrls(tabs)

      expect(urls).toHaveLength(2)
      expect(urls).toContain("amazon.com/page")
      expect(urls).toContain("ebay.com/item")
    })

    it("should handle http and https URLs the same way", () => {
      const tabs = createMockTabs(["http://example.com/page", "https://secure.example.com/page"])

      const urls = contextMenuService.extractFullUrls(tabs)

      expect(urls).toHaveLength(2)
      expect(urls).toContain("example.com/page")
      expect(urls).toContain("secure.example.com/page")
    })
  })
})
