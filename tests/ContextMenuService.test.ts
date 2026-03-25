import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Browser } from "wxt/browser"

import type { CustomRule } from "../types"

const mockGetCustomRules = vi.fn()
const mockUpdateRule = vi.fn()

vi.mock("../services/RulesService", () => ({
  rulesService: {
    getCustomRules: (...args: unknown[]) => mockGetCustomRules(...args),
    updateRule: (...args: unknown[]) => mockUpdateRule(...args)
  }
}))

vi.mock("../services/TabGroupService", () => ({
  tabGroupService: {
    ungroupAllTabs: vi.fn().mockResolvedValue(undefined),
    groupAllTabsManually: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock("../services/TabGroupState", () => ({
  tabGroupState: {
    getCustomRulesObject: vi.fn().mockReturnValue({})
  }
}))

vi.mock("../utils/storage", () => ({
  saveAllStorage: vi.fn().mockResolvedValue(undefined)
}))

// Import after mocks are set up
const { contextMenuService } = await import("../services/ContextMenuService")

// Helper to create mock tabs with just the url property
function createMockTabs(urls: (string | undefined)[]): Browser.tabs.Tab[] {
  return urls.map(url => ({ url }) as unknown as Browser.tabs.Tab)
}

function createMockRule(overrides: Partial<CustomRule> = {}): CustomRule {
  return {
    id: "rule-1",
    name: "Shopping",
    domains: ["amazon.com", "ebay.com"],
    color: "blue",
    enabled: true,
    priority: 0,
    minimumTabs: 1,
    createdAt: "2025-01-01T00:00:00.000Z",
    ...overrides
  }
}

describe("ContextMenuService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("addDomainToRule", () => {
    it("should add a new domain to an existing rule", async () => {
      const rule = createMockRule()
      mockGetCustomRules.mockResolvedValue({ "rule-1": rule })
      mockUpdateRule.mockResolvedValue(true)

      const result = await contextMenuService.addDomainToRule("rule-1", "walmart.com")

      expect(result).toEqual({ success: true, alreadyExists: false })
      expect(mockUpdateRule).toHaveBeenCalledWith("rule-1", {
        name: "Shopping",
        domains: ["amazon.com", "ebay.com", "walmart.com"],
        color: "blue",
        enabled: true,
        priority: 0,
        minimumTabs: 1
      })
    })

    it("should return alreadyExists when domain is already in the rule", async () => {
      const rule = createMockRule()
      mockGetCustomRules.mockResolvedValue({ "rule-1": rule })

      const result = await contextMenuService.addDomainToRule("rule-1", "amazon.com")

      expect(result).toEqual({ success: true, alreadyExists: true })
      expect(mockUpdateRule).not.toHaveBeenCalled()
    })

    it("should match existing domains case-insensitively", async () => {
      const rule = createMockRule()
      mockGetCustomRules.mockResolvedValue({ "rule-1": rule })

      const result = await contextMenuService.addDomainToRule("rule-1", "Amazon.COM")

      expect(result).toEqual({ success: true, alreadyExists: true })
      expect(mockUpdateRule).not.toHaveBeenCalled()
    })

    it("should normalize domain to lowercase and trim whitespace", async () => {
      const rule = createMockRule()
      mockGetCustomRules.mockResolvedValue({ "rule-1": rule })
      mockUpdateRule.mockResolvedValue(true)

      const result = await contextMenuService.addDomainToRule("rule-1", "  Walmart.COM  ")

      expect(result).toEqual({ success: true, alreadyExists: false })
      expect(mockUpdateRule).toHaveBeenCalledWith(
        "rule-1",
        expect.objectContaining({
          domains: ["amazon.com", "ebay.com", "walmart.com"]
        })
      )
    })

    it("should return error when rule is not found", async () => {
      mockGetCustomRules.mockResolvedValue({})

      const result = await contextMenuService.addDomainToRule("nonexistent", "walmart.com")

      expect(result).toEqual({
        success: false,
        error: "Rule with ID nonexistent not found"
      })
      expect(mockUpdateRule).not.toHaveBeenCalled()
    })

    it("should return error when rulesService throws", async () => {
      mockGetCustomRules.mockRejectedValue(new Error("Storage read failed"))

      const result = await contextMenuService.addDomainToRule("rule-1", "walmart.com")

      expect(result).toEqual({
        success: false,
        error: "Storage read failed"
      })
    })

    it("should return error when updateRule throws", async () => {
      const rule = createMockRule()
      mockGetCustomRules.mockResolvedValue({ "rule-1": rule })
      mockUpdateRule.mockRejectedValue(new Error("Storage write failed"))

      const result = await contextMenuService.addDomainToRule("rule-1", "walmart.com")

      expect(result).toEqual({
        success: false,
        error: "Storage write failed"
      })
    })

    it("should not mutate the original rule domains array", async () => {
      const originalDomains = ["amazon.com", "ebay.com"]
      const rule = createMockRule({ domains: originalDomains })
      mockGetCustomRules.mockResolvedValue({ "rule-1": rule })
      mockUpdateRule.mockResolvedValue(true)

      await contextMenuService.addDomainToRule("rule-1", "walmart.com")

      expect(originalDomains).toEqual(["amazon.com", "ebay.com"])
    })

    it("should handle rule with empty domains array", async () => {
      const rule = createMockRule({ domains: [] })
      mockGetCustomRules.mockResolvedValue({ "rule-1": rule })
      mockUpdateRule.mockResolvedValue(true)

      const result = await contextMenuService.addDomainToRule("rule-1", "amazon.com")

      expect(result).toEqual({ success: true, alreadyExists: false })
      expect(mockUpdateRule).toHaveBeenCalledWith(
        "rule-1",
        expect.objectContaining({ domains: ["amazon.com"] })
      )
    })

    it("should handle non-Error exceptions gracefully", async () => {
      mockGetCustomRules.mockRejectedValue("string error")

      const result = await contextMenuService.addDomainToRule("rule-1", "walmart.com")

      expect(result).toEqual({
        success: false,
        error: "Unknown error"
      })
    })

    it("should preserve all rule properties when updating", async () => {
      const rule = createMockRule({
        name: "Custom Rule",
        color: "red",
        enabled: false,
        priority: 5,
        minimumTabs: 3
      })
      mockGetCustomRules.mockResolvedValue({ "rule-1": rule })
      mockUpdateRule.mockResolvedValue(true)

      await contextMenuService.addDomainToRule("rule-1", "walmart.com")

      expect(mockUpdateRule).toHaveBeenCalledWith("rule-1", {
        name: "Custom Rule",
        domains: ["amazon.com", "ebay.com", "walmart.com"],
        color: "red",
        enabled: false,
        priority: 5,
        minimumTabs: 3
      })
    })
  })

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
