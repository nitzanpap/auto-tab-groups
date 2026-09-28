import { describe, expect, it } from "vitest"
import { extractOrigin, getFaviconUrl, FaviconManager } from "../entrypoints/graph-3d.unlisted/modules/favicon"

describe("3D Graph Favicon Pipeline & Caching", () => {
  describe("extractOrigin", () => {
    it("should extract protocol and hostname for standard HTTP/HTTPS URLs", () => {
      expect(extractOrigin("https://github.com/owner/repo/pulls")).toBe("https://github.com")
      expect(extractOrigin("http://localhost:3000/dashboard")).toBe("http://localhost")
      expect(extractOrigin("https://sub.domain.example.co.uk/path?q=1")).toBe("https://sub.domain.example.co.uk")
    })

    it("should handle internal and extension URLs", () => {
      expect(extractOrigin("chrome://extensions")).toBe("chrome://extensions")
      expect(extractOrigin("chrome-extension://abcdef/page.html")).toBe("chrome-extension://abcdef")
      expect(extractOrigin("moz-extension://12345/options.html")).toBe("moz-extension://12345")
    })

    it("should handle empty or invalid input gracefully", () => {
      expect(extractOrigin("")).toBe("")
      expect(extractOrigin(undefined)).toBe("")
      expect(extractOrigin("random-string")).toBe("random-string")
    })
  })

  describe("getFaviconUrl", () => {
    it("should preserve direct data and blob URLs", () => {
      const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
      expect(getFaviconUrl("https://example.com", dataUrl)).toBe(dataUrl)

      const blobUrl = "blob:https://example.com/uuid"
      expect(getFaviconUrl("https://example.com", blobUrl)).toBe(blobUrl)
    })

    it("should return valid direct http/https favicon URLs", () => {
      const httpsFavicon = "https://github.githubassets.com/favicons/favicon.svg"
      expect(getFaviconUrl(undefined, httpsFavicon)).toBe(httpsFavicon)
    })

    it("should return Chrome _favicon URL or fallback to Google S2 for public websites", () => {
      const res = getFaviconUrl("https://news.ycombinator.com/item?id=123", "")
      expect(res).toBeTruthy()
      expect(res?.includes("_favicon") || res?.includes("google.com/s2/favicons")).toBe(true)
    })
  })

  describe("FaviconManager", () => {
    it("should reuse cached CanvasTexture for the same origin", () => {
      const manager = new FaviconManager()
      const origin = "https://github.com"

      const texture1 = manager.getTexture(origin, "github.com", "https://github.com/foo", "")
      const texture2 = manager.getTexture(origin, "github.com", "https://github.com/bar", "")

      expect(texture1).toBe(texture2)
    })

    it("should create distinct CanvasTextures for different origins", () => {
      const manager = new FaviconManager()
      const textureA = manager.getTexture("https://github.com", "github.com", "https://github.com", "")
      const textureB = manager.getTexture("https://google.com", "google.com", "https://google.com", "")

      expect(textureA).not.toBe(textureB)
    })
  })
})
