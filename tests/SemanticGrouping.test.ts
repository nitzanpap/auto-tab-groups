import { describe, expect, it } from "vitest"
import { detectEntityAndColor } from "../utils/EntityServiceDetector"
import {
  calculateTabSimilarity,
  clusterTabsBySemanticSimilarity,
  extractPageTokens,
  generateMeaningfulGroupName
} from "../utils/SemanticGrouping"

describe("EntityServiceDetector", () => {
  it("detects Google services and assigns appropriate colors", () => {
    const google = detectEntityAndColor("https://www.google.com/search?q=test")
    expect(google).not.toBeNull()
    expect(google?.name).toBe("Google")
    expect(google?.color).toBe("blue")

    const docs = detectEntityAndColor("https://docs.google.com/document/d/123/edit")
    expect(docs?.name).toBe("Google Docs")
    expect(docs?.color).toBe("blue")
  })

  it("detects YouTube and assigns red color", () => {
    const yt = detectEntityAndColor("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    expect(yt?.name).toBe("YouTube")
    expect(yt?.color).toBe("red")
  })

  it("detects GitHub and assigns purple color", () => {
    const gh = detectEntityAndColor("https://github.com/torvalds/linux")
    expect(gh?.name).toBe("GitHub")
    expect(gh?.color).toBe("purple")
  })

  it("detects developer documentation and shopping heuristics", () => {
    const doc = detectEntityAndColor("https://docs.docker.com/get-started/")
    expect(doc?.name).toBe("Docs")
    expect(doc?.color).toBe("cyan")

    const shop = detectEntityAndColor("https://www.mystore.com/checkout/cart")
    expect(shop?.name).toBe("Shopping")
    expect(shop?.color).toBe("yellow")
  })
})

describe("SemanticGrouping", () => {
  it("extracts meaningful tokens from URL and title", () => {
    const tokens = extractPageTokens(
      "https://github.com/facebook/react/issues/123",
      "React Hooks Memory Leak Issue"
    )
    expect(tokens.has("react")).toBe(true)
    expect(tokens.has("hooks")).toBe(true)
    expect(tokens.has("memory")).toBe(true)
    expect(tokens.has("leak")).toBe(true)
  })

  it("clusters tabs with similar purpose above threshold", () => {
    const tabs = [
      { id: 1, url: "https://www.youtube.com/watch?v=1", title: "React Tutorial Part 1" },
      { id: 2, url: "https://www.youtube.com/watch?v=2", title: "React Tutorial Part 2" },
      { id: 3, url: "https://www.amazon.com/dp/B081", title: "Ergonomic Mechanical Keyboard" },
      { id: 4, url: "https://www.amazon.com/dp/B082", title: "Wireless Gaming Mouse" }
    ]

    const clusters = clusterTabsBySemanticSimilarity(tabs, 0.5)
    expect(clusters.length).toBe(2)

    const ytCluster = clusters.find(c => c.tabIds.includes(1))
    expect(ytCluster?.tabIds).toContain(2)
    expect(ytCluster?.groupName).toBe("YouTube")
    expect(ytCluster?.color).toBe("red")

    const amazonCluster = clusters.find(c => c.tabIds.includes(3))
    expect(amazonCluster?.tabIds).toContain(4)
    expect(amazonCluster?.groupName).toBe("Amazon")
    expect(amazonCluster?.color).toBe("yellow")
  })

  it("respects high similarity threshold and splits dissimilar pages", () => {
    const tabs = [
      { id: 1, url: "https://example.com/cooking/pasta", title: "Cooking Italian Pasta" },
      { id: 2, url: "https://different.org/astronomy/stars", title: "Deep Space Galaxies" }
    ]

    const clusters = clusterTabsBySemanticSimilarity(tabs, 0.8)
    expect(clusters.length).toBe(2)
  })
})
