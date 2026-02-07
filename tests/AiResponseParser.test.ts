import { describe, expect, it } from "vitest"
import {
  extractJsonFromResponse,
  normalizeColor,
  parseAiRuleResponse,
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
})
