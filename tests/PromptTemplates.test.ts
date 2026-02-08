import { describe, expect, it } from "vitest"
import {
  ruleGenerationPrompt,
  SUGGESTION_SCHEMA,
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

    it("should emphasize topic-based grouping over domain", () => {
      const messages = tabGroupSuggestionPrompt([{ title: "Test", url: "https://test.com" }])
      expect(messages[0].content).toContain("TOPIC")
      expect(messages[0].content).toContain("not by website")
    })

    it("should instruct descriptive category names", () => {
      const messages = tabGroupSuggestionPrompt([{ title: "Test", url: "https://test.com" }])
      expect(messages[0].content).toContain("descriptive category names")
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

    it("should use a cross-domain example (hiking/cooking from different sites)", () => {
      const messages = tabGroupSuggestionPrompt([{ title: "Test", url: "https://test.com" }])
      expect(messages[0].content).toContain("Hiking")
      expect(messages[0].content).toContain("Cooking")
    })

    it("should ask for {groups: [...]} wrapper format", () => {
      const messages = tabGroupSuggestionPrompt([{ title: "Test", url: "https://test.com" }])
      expect(messages[0].content).toContain('{"groups"')
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

  describe("SUGGESTION_SCHEMA", () => {
    it("should be a valid JSON string", () => {
      expect(() => JSON.parse(SUGGESTION_SCHEMA)).not.toThrow()
    })

    it("should describe an object with a groups array", () => {
      const schema = JSON.parse(SUGGESTION_SCHEMA)
      expect(schema.type).toBe("object")
      expect(schema.required).toContain("groups")
      expect(schema.properties.groups.type).toBe("array")
    })

    it("should require groupName, tabIndices, and color in items", () => {
      const schema = JSON.parse(SUGGESTION_SCHEMA)
      const itemProps = schema.properties.groups.items.properties
      expect(itemProps.groupName).toBeDefined()
      expect(itemProps.tabIndices).toBeDefined()
      expect(itemProps.color).toBeDefined()
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
