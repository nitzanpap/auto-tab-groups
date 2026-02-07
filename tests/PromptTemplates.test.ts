import { describe, expect, it } from "vitest"
import {
  ruleGenerationPrompt,
  tabExplainerPrompt,
  tabGroupSuggestionPrompt
} from "../utils/PromptTemplates"

describe("PromptTemplates", () => {
  describe("ruleGenerationPrompt", () => {
    it("should return an array of AiChatMessage objects", () => {
      const messages = ruleGenerationPrompt("Group all social media", [
        "twitter.com",
        "facebook.com"
      ])
      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe("system")
      expect(messages[1].role).toBe("user")
    })

    it("should include the description in the user message", () => {
      const messages = ruleGenerationPrompt("Group all social media", [])
      expect(messages[1].content).toContain("Group all social media")
    })

    it("should include existing domains when provided", () => {
      const messages = ruleGenerationPrompt("Group social", ["twitter.com", "facebook.com"])
      expect(messages[1].content).toContain("twitter.com")
      expect(messages[1].content).toContain("facebook.com")
    })

    it("should omit domains line when no domains provided", () => {
      const messages = ruleGenerationPrompt("Group social", [])
      expect(messages[1].content).not.toContain("Currently open domains")
    })

    it("should have system message requesting JSON output", () => {
      const messages = ruleGenerationPrompt("test", [])
      expect(messages[0].content).toContain("JSON")
    })

    it("should include a few-shot example in the system prompt", () => {
      const messages = ruleGenerationPrompt("test", [])
      expect(messages[0].content).toContain("Example input")
      expect(messages[0].content).toContain("Example output")
      expect(messages[0].content).toContain("chromewebstore.google.com")
    })

    it("should instruct short group names (1-3 words)", () => {
      const messages = ruleGenerationPrompt("test", [])
      expect(messages[0].content).toContain("1-3 words")
    })

    it("should list all valid color options in the system prompt", () => {
      const messages = ruleGenerationPrompt("test", [])
      const colors = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"]
      for (const color of colors) {
        expect(messages[0].content).toContain(color)
      }
    })
  })

  describe("tabGroupSuggestionPrompt", () => {
    it("should return an array of AiChatMessage objects", () => {
      const messages = tabGroupSuggestionPrompt([
        { title: "Google", url: "https://google.com" },
        { title: "GitHub", url: "https://github.com" }
      ])
      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe("system")
      expect(messages[1].role).toBe("user")
    })

    it("should list tabs with domains in brackets and titles", () => {
      const tabs = [
        { title: "Google", url: "https://google.com" },
        { title: "GitHub", url: "https://github.com" }
      ]
      const messages = tabGroupSuggestionPrompt(tabs)
      expect(messages[1].content).toContain('[google.com] "Google"')
      expect(messages[1].content).toContain('[github.com] "GitHub"')
    })

    it("should emphasize domain-based grouping in system prompt", () => {
      const messages = tabGroupSuggestionPrompt([{ title: "Test", url: "https://test.com" }])
      expect(messages[0].content).toContain("same domain")
    })

    it("should number the tabs", () => {
      const messages = tabGroupSuggestionPrompt([
        { title: "Tab1", url: "https://one.com" },
        { title: "Tab2", url: "https://two.com" }
      ])
      expect(messages[1].content).toContain("1.")
      expect(messages[1].content).toContain("2.")
    })

    it("should include a few-shot example in the system prompt", () => {
      const messages = tabGroupSuggestionPrompt([{ title: "Test", url: "https://test.com" }])
      expect(messages[0].content).toContain("Example:")
      expect(messages[0].content).toContain("Input:")
      expect(messages[0].content).toContain("Output:")
    })

    it("should use a dissimilar example (travel/cooking, not dev)", () => {
      const messages = tabGroupSuggestionPrompt([{ title: "Test", url: "https://test.com" }])
      expect(messages[0].content).toContain("Travel")
      expect(messages[0].content).toContain("Cooking")
    })

    it("should instruct short group names (1-3 words)", () => {
      const messages = tabGroupSuggestionPrompt([{ title: "Test", url: "https://test.com" }])
      expect(messages[0].content).toContain("1-3 words")
    })

    it("should instruct every tab in exactly one group", () => {
      const messages = tabGroupSuggestionPrompt([{ title: "Test", url: "https://test.com" }])
      expect(messages[0].content).toContain("every tab in exactly one group")
    })
  })

  describe("tabExplainerPrompt", () => {
    it("should return an array of AiChatMessage objects", () => {
      const messages = tabExplainerPrompt("Google", "https://google.com")
      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe("system")
      expect(messages[1].role).toBe("user")
    })

    it("should include the title and URL", () => {
      const messages = tabExplainerPrompt("GitHub", "https://github.com")
      expect(messages[1].content).toContain("GitHub")
      expect(messages[1].content).toContain("https://github.com")
    })

    it("should ask for a concise description", () => {
      const messages = tabExplainerPrompt("test", "https://test.com")
      expect(messages[0].content).toContain("one sentence")
    })
  })
})
