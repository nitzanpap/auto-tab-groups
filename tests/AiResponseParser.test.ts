import { describe, expect, it } from "vitest"
import {
  extractJsonArrayFromResponse,
  extractJsonFromResponse,
  normalizeColor,
  parseAiRuleResponse,
  parseAiSuggestionResponse,
  sanitizeGeneratedDomains,
  validateParsedRule
} from "../utils/AiResponseParser"

describe("AiResponseParser", () => {
  describe("parseAiRuleResponse", () => {
    it("should parse valid JSON with all fields", () => {
      const input = '{"name":"Google","domains":["*.google.com","gmail.com"],"color":"blue"}'
      const result = parseAiRuleResponse(input)
      expect(result.success).toBe(true)
      expect(result.rule).toEqual({
        name: "Google",
        domains: ["*.google.com", "gmail.com"],
        color: "blue"
      })
      expect(result.warnings).toEqual([])
    })

    it("should extract JSON from markdown code fence", () => {
      const input = '```json\n{"name":"AWS","domains":["*.aws.amazon.com"],"color":"orange"}\n```'
      const result = parseAiRuleResponse(input)
      expect(result.success).toBe(true)
      expect(result.rule?.name).toBe("AWS")
      expect(result.rule?.color).toBe("orange")
    })

    it("should extract JSON from code fence without language tag", () => {
      const input = '```\n{"name":"Test","domains":["test.com"],"color":"red"}\n```'
      const result = parseAiRuleResponse(input)
      expect(result.success).toBe(true)
      expect(result.rule?.name).toBe("Test")
    })

    it("should extract JSON with surrounding text", () => {
      const input =
        'Here is your rule: {"name":"Social","domains":["twitter.com","facebook.com"],"color":"cyan"} Hope this helps!'
      const result = parseAiRuleResponse(input)
      expect(result.success).toBe(true)
      expect(result.rule?.name).toBe("Social")
      expect(result.rule?.domains).toEqual(["twitter.com", "facebook.com"])
    })

    it("should return error for empty string", () => {
      const result = parseAiRuleResponse("")
      expect(result.success).toBe(false)
      expect(result.error).toBe("Empty or invalid AI response")
    })

    it("should return error for non-string input", () => {
      const result = parseAiRuleResponse(null as unknown as string)
      expect(result.success).toBe(false)
      expect(result.error).toBe("Empty or invalid AI response")
    })

    it("should return error for completely invalid content", () => {
      const result = parseAiRuleResponse("This is not JSON at all")
      expect(result.success).toBe(false)
      expect(result.error).toBe("Could not extract JSON from AI response")
    })

    it("should return error for malformed JSON", () => {
      const result = parseAiRuleResponse('{"name": "Test", "domains": [}')
      expect(result.success).toBe(false)
      expect(result.error).toContain("Could not extract JSON")
    })

    it("should return error when name is missing", () => {
      const input = '{"domains":["test.com"],"color":"blue"}'
      const result = parseAiRuleResponse(input)
      expect(result.success).toBe(false)
      expect(result.error).toContain("name")
    })

    it("should return error when domains is missing", () => {
      const input = '{"name":"Test","color":"blue"}'
      const result = parseAiRuleResponse(input)
      expect(result.success).toBe(false)
      expect(result.error).toContain("domains")
    })

    it("should return error for empty name", () => {
      const input = '{"name":"  ","domains":["test.com"],"color":"blue"}'
      const result = parseAiRuleResponse(input)
      expect(result.success).toBe(false)
      expect(result.error).toContain("empty 'name'")
    })

    it("should succeed with empty domains array and add warning", () => {
      const input = '{"name":"Test","domains":[],"color":"blue"}'
      const result = parseAiRuleResponse(input)
      expect(result.success).toBe(true)
      expect(result.rule?.domains).toEqual([])
      expect(result.warnings).toContain("No valid domain patterns generated")
    })

    it("should normalize invalid color to blue with warning", () => {
      const input = '{"name":"Test","domains":["test.com"],"color":"rainbow"}'
      const result = parseAiRuleResponse(input)
      expect(result.success).toBe(true)
      expect(result.rule?.color).toBe("blue")
      expect(result.warnings.some(w => w.includes("rainbow"))).toBe(true)
    })

    it("should handle missing color field without warning", () => {
      const input = '{"name":"Test","domains":["test.com"]}'
      const result = parseAiRuleResponse(input)
      expect(result.success).toBe(true)
      expect(result.rule?.color).toBe("blue")
      expect(result.warnings).toEqual([])
    })

    it("should filter invalid domain patterns with warning", () => {
      const input =
        '{"name":"Test","domains":["google.com","://invalid","github.com"],"color":"green"}'
      const result = parseAiRuleResponse(input)
      expect(result.success).toBe(true)
      expect(result.rule?.domains).toEqual(["google.com", "github.com"])
      expect(result.warnings.some(w => w.includes("invalid"))).toBe(true)
    })

    it("should trim name whitespace", () => {
      const input = '{"name":"  Google Apps  ","domains":["google.com"],"color":"blue"}'
      const result = parseAiRuleResponse(input)
      expect(result.success).toBe(true)
      expect(result.rule?.name).toBe("Google Apps")
    })
  })

  describe("extractJsonFromResponse", () => {
    it("should return pure JSON directly", () => {
      const json = '{"key":"value"}'
      expect(extractJsonFromResponse(json)).toBe(json)
    })

    it("should extract from markdown fence", () => {
      const input = '```json\n{"key":"value"}\n```'
      expect(extractJsonFromResponse(input)).toBe('{"key":"value"}')
    })

    it("should extract first { ... } block when no fence", () => {
      const input = 'Response: {"key":"value"} end'
      expect(extractJsonFromResponse(input)).toBe('{"key":"value"}')
    })

    it("should return null for no JSON", () => {
      expect(extractJsonFromResponse("no json here")).toBeNull()
    })

    it("should handle whitespace-padded input", () => {
      const input = '  \n  {"key":"value"}  \n  '
      expect(extractJsonFromResponse(input)).toBe('{"key":"value"}')
    })
  })

  describe("validateParsedRule", () => {
    it("should reject non-object values", () => {
      expect(validateParsedRule("string").success).toBe(false)
      expect(validateParsedRule(42).success).toBe(false)
      expect(validateParsedRule(null).success).toBe(false)
      expect(validateParsedRule([]).success).toBe(false)
    })

    it("should reject object with non-string name", () => {
      const result = validateParsedRule({ name: 123, domains: ["test.com"], color: "blue" })
      expect(result.success).toBe(false)
      expect(result.error).toContain("name")
    })

    it("should reject object with non-array domains", () => {
      const result = validateParsedRule({ name: "Test", domains: "test.com", color: "blue" })
      expect(result.success).toBe(false)
      expect(result.error).toContain("domains")
    })
  })

  describe("sanitizeGeneratedDomains", () => {
    it("should pass valid domains through", () => {
      const result = sanitizeGeneratedDomains(["google.com", "*.github.com"])
      expect(result.valid).toEqual(["google.com", "*.github.com"])
      expect(result.invalid).toEqual([])
    })

    it("should filter out invalid patterns", () => {
      const result = sanitizeGeneratedDomains(["google.com", "://bad"])
      expect(result.valid).toEqual(["google.com"])
      expect(result.invalid).toEqual(["://bad"])
    })

    it("should deduplicate domains", () => {
      const result = sanitizeGeneratedDomains(["google.com", "google.com", "github.com"])
      expect(result.valid).toEqual(["google.com", "github.com"])
    })

    it("should skip non-string and empty values", () => {
      const result = sanitizeGeneratedDomains([123, "", null, "google.com", undefined] as unknown[])
      expect(result.valid).toEqual(["google.com"])
    })

    it("should trim whitespace from domains", () => {
      const result = sanitizeGeneratedDomains(["  google.com  ", "  github.com  "])
      expect(result.valid).toEqual(["google.com", "github.com"])
    })
  })

  describe("normalizeColor", () => {
    it("should return valid colors as-is", () => {
      expect(normalizeColor("blue")).toBe("blue")
      expect(normalizeColor("red")).toBe("red")
      expect(normalizeColor("grey")).toBe("grey")
    })

    it("should handle capitalized colors", () => {
      expect(normalizeColor("Blue")).toBe("blue")
      expect(normalizeColor("RED")).toBe("red")
      expect(normalizeColor("Green")).toBe("green")
    })

    it("should default to blue for unknown colors", () => {
      expect(normalizeColor("rainbow")).toBe("blue")
      expect(normalizeColor("")).toBe("blue")
      expect(normalizeColor(null)).toBe("blue")
      expect(normalizeColor(123)).toBe("blue")
    })
  })

  describe("extractJsonArrayFromResponse", () => {
    it("should return pure JSON array directly", () => {
      const json = '[{"groupName":"Dev","tabIndices":[1,2],"color":"blue"}]'
      expect(extractJsonArrayFromResponse(json)).toBe(json)
    })

    it("should extract from markdown fence", () => {
      const input = '```json\n[{"groupName":"Dev","tabIndices":[1],"color":"blue"}]\n```'
      expect(extractJsonArrayFromResponse(input)).toBe(
        '[{"groupName":"Dev","tabIndices":[1],"color":"blue"}]'
      )
    })

    it("should extract first [ ... ] block when no fence", () => {
      const input =
        'Here are the groups: [{"groupName":"Dev","tabIndices":[1],"color":"blue"}] Hope this helps!'
      expect(extractJsonArrayFromResponse(input)).toBe(
        '[{"groupName":"Dev","tabIndices":[1],"color":"blue"}]'
      )
    })

    it("should return null for no JSON array", () => {
      expect(extractJsonArrayFromResponse("no json here")).toBeNull()
    })

    it("should return null for JSON object without groupName", () => {
      expect(extractJsonArrayFromResponse('{"key":"value"}')).toBeNull()
    })

    it("should wrap a single suggestion object in an array", () => {
      const input = '{"groupName":"Dev","tabIndices":[1,2],"color":"blue"}'
      const result = extractJsonArrayFromResponse(input)
      expect(result).not.toBeNull()
      const parsed = JSON.parse(result!)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].groupName).toBe("Dev")
    })

    it("should wrap a single object from markdown fence in an array", () => {
      const input = '```json\n{"groupName":"Dev","tabIndices":[1],"color":"blue"}\n```'
      const result = extractJsonArrayFromResponse(input)
      expect(result).not.toBeNull()
      const parsed = JSON.parse(result!)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed[0].groupName).toBe("Dev")
    })

    it("should wrap a single object from surrounding text in an array", () => {
      const input = 'Here is the result: {"groupName":"Dev","tabIndices":[1],"color":"blue"} done'
      const result = extractJsonArrayFromResponse(input)
      expect(result).not.toBeNull()
      const parsed = JSON.parse(result!)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed[0].groupName).toBe("Dev")
    })

    it("should handle whitespace-padded input", () => {
      const input = '  \n  [{"groupName":"A","tabIndices":[1],"color":"blue"}]  \n  '
      expect(extractJsonArrayFromResponse(input)).toBe(
        '[{"groupName":"A","tabIndices":[1],"color":"blue"}]'
      )
    })
  })

  describe("parseAiSuggestionResponse", () => {
    const sampleTabs = [
      { tabId: 101, title: "GitHub - repo", url: "https://github.com/user/repo" },
      { tabId: 102, title: "Stack Overflow - JS", url: "https://stackoverflow.com/q/123" },
      { tabId: 103, title: "YouTube - Music", url: "https://youtube.com/watch?v=abc" },
      { tabId: 104, title: "MDN Web Docs", url: "https://developer.mozilla.org/en-US/docs" }
    ]

    it("should parse valid JSON array with all fields", () => {
      const input =
        '[{"groupName":"Dev","tabIndices":[1,2,4],"color":"blue"},{"groupName":"Media","tabIndices":[3],"color":"red"}]'
      const result = parseAiSuggestionResponse(input, sampleTabs)
      expect(result.success).toBe(true)
      expect(result.suggestions).toHaveLength(2)
      expect(result.suggestions[0].groupName).toBe("Dev")
      expect(result.suggestions[0].tabs).toHaveLength(3)
      expect(result.suggestions[0].tabs[0].tabId).toBe(101)
      expect(result.suggestions[0].tabs[1].tabId).toBe(102)
      expect(result.suggestions[0].tabs[2].tabId).toBe(104)
      expect(result.suggestions[0].color).toBe("blue")
      expect(result.suggestions[1].groupName).toBe("Media")
      expect(result.suggestions[1].tabs).toHaveLength(1)
      expect(result.suggestions[1].tabs[0].tabId).toBe(103)
      expect(result.suggestions[1].color).toBe("red")
    })

    it("should extract JSON array from markdown code fence", () => {
      const input = '```json\n[{"groupName":"Dev","tabIndices":[1,2],"color":"green"}]\n```'
      const result = parseAiSuggestionResponse(input, sampleTabs)
      expect(result.success).toBe(true)
      expect(result.suggestions).toHaveLength(1)
      expect(result.suggestions[0].groupName).toBe("Dev")
    })

    it("should extract JSON array with surrounding text", () => {
      const input =
        'Here are my suggestions: [{"groupName":"All","tabIndices":[1,2,3,4],"color":"cyan"}] Done!'
      const result = parseAiSuggestionResponse(input, sampleTabs)
      expect(result.success).toBe(true)
      expect(result.suggestions[0].tabs).toHaveLength(4)
    })

    it("should return error for empty string", () => {
      const result = parseAiSuggestionResponse("", sampleTabs)
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it("should handle single object without tabIndices gracefully", () => {
      const result = parseAiSuggestionResponse('{"groupName":"Dev"}', sampleTabs)
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it("should filter out-of-range tab indices with warning", () => {
      const input = '[{"groupName":"Dev","tabIndices":[1,2,99],"color":"blue"}]'
      const result = parseAiSuggestionResponse(input, sampleTabs)
      expect(result.success).toBe(true)
      expect(result.suggestions[0].tabs).toHaveLength(2)
      expect(result.warnings.some(w => w.includes("out-of-range"))).toBe(true)
    })

    it("should skip suggestions with no valid tab indices", () => {
      const input =
        '[{"groupName":"Bad","tabIndices":[99,100],"color":"blue"},{"groupName":"Good","tabIndices":[1],"color":"red"}]'
      const result = parseAiSuggestionResponse(input, sampleTabs)
      expect(result.success).toBe(true)
      expect(result.suggestions).toHaveLength(1)
      expect(result.suggestions[0].groupName).toBe("Good")
      expect(result.warnings.some(w => w.includes("Bad"))).toBe(true)
    })

    it("should normalize invalid colors to blue with warning", () => {
      const input = '[{"groupName":"Dev","tabIndices":[1],"color":"rainbow"}]'
      const result = parseAiSuggestionResponse(input, sampleTabs)
      expect(result.success).toBe(true)
      expect(result.suggestions[0].color).toBe("blue")
      expect(result.warnings.some(w => w.includes("rainbow"))).toBe(true)
    })

    it("should trim group names", () => {
      const input = '[{"groupName":"  Dev Tools  ","tabIndices":[1],"color":"blue"}]'
      const result = parseAiSuggestionResponse(input, sampleTabs)
      expect(result.success).toBe(true)
      expect(result.suggestions[0].groupName).toBe("Dev Tools")
    })

    it("should truncate group names longer than 3 words", () => {
      const input =
        '[{"groupName":"Technicians app for reading meters","tabIndices":[1],"color":"blue"}]'
      const result = parseAiSuggestionResponse(input, sampleTabs)
      expect(result.success).toBe(true)
      expect(result.suggestions[0].groupName).toBe("Technicians app for")
    })

    it("should deduplicate tabs across groups (first-wins)", () => {
      const input =
        '[{"groupName":"A","tabIndices":[1,2],"color":"blue"},{"groupName":"B","tabIndices":[2,3],"color":"red"}]'
      const result = parseAiSuggestionResponse(input, sampleTabs)
      expect(result.success).toBe(true)
      expect(result.suggestions[0].tabs).toHaveLength(2)
      expect(result.suggestions[1].tabs).toHaveLength(1)
      expect(result.suggestions[1].tabs[0].tabId).toBe(103)
    })

    it("should return error when no valid suggestions remain", () => {
      const input = '[{"groupName":"Bad","tabIndices":[99],"color":"blue"}]'
      const result = parseAiSuggestionResponse(input, sampleTabs)
      expect(result.success).toBe(false)
      expect(result.error).toContain("No valid suggestions")
    })

    it("should skip suggestions with empty or missing groupName", () => {
      const input =
        '[{"groupName":"","tabIndices":[1],"color":"blue"},{"tabIndices":[2],"color":"red"},{"groupName":"Valid","tabIndices":[3],"color":"green"}]'
      const result = parseAiSuggestionResponse(input, sampleTabs)
      expect(result.success).toBe(true)
      expect(result.suggestions).toHaveLength(1)
      expect(result.suggestions[0].groupName).toBe("Valid")
    })

    it("should handle non-number tab indices gracefully", () => {
      const input = '[{"groupName":"Dev","tabIndices":[1,"two",null,3],"color":"blue"}]'
      const result = parseAiSuggestionResponse(input, sampleTabs)
      expect(result.success).toBe(true)
      expect(result.suggestions[0].tabs).toHaveLength(2)
      expect(result.suggestions[0].tabs[0].tabId).toBe(101)
      expect(result.suggestions[0].tabs[1].tabId).toBe(103)
    })
  })
})
