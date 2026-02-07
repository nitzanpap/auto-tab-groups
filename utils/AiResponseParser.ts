/**
 * Parses and validates AI-generated rule responses.
 * Pure functions — no browser API dependencies.
 */

import type { TabGroupColor } from "../types"
import { isValidColor } from "./Constants"
import { urlPatternMatcher } from "./UrlPatternMatcher"

export interface ParsedRuleResult {
  success: boolean
  rule?: {
    name: string
    domains: string[]
    color: TabGroupColor
  }
  error?: string
  warnings: string[]
}

/**
 * Parse raw AI text output into structured rule data.
 * Handles: direct JSON, JSON in markdown fences, JSON with surrounding text.
 */
export function parseAiRuleResponse(rawContent: string): ParsedRuleResult {
  if (!rawContent || typeof rawContent !== "string") {
    return { success: false, error: "Empty or invalid AI response", warnings: [] }
  }

  const jsonString = extractJsonFromResponse(rawContent)
  if (!jsonString) {
    return { success: false, error: "Could not extract JSON from AI response", warnings: [] }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonString)
  } catch {
    return { success: false, error: "AI response contained invalid JSON", warnings: [] }
  }

  return validateParsedRule(parsed)
}

/**
 * Try multiple strategies to extract a JSON object string from AI output.
 */
export function extractJsonFromResponse(content: string): string | null {
  const trimmed = content.trim()

  // Strategy 1: Direct parse — content is pure JSON
  try {
    JSON.parse(trimmed)
    return trimmed
  } catch {
    // Continue to next strategy
  }

  // Strategy 2: Extract from markdown code fence
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenceMatch?.[1]) {
    try {
      JSON.parse(fenceMatch[1].trim())
      return fenceMatch[1].trim()
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 3: Find first { ... } block
  const braceStart = trimmed.indexOf("{")
  const braceEnd = trimmed.lastIndexOf("}")
  if (braceStart !== -1 && braceEnd > braceStart) {
    const candidate = trimmed.slice(braceStart, braceEnd + 1)
    try {
      JSON.parse(candidate)
      return candidate
    } catch {
      // No valid JSON found
    }
  }

  return null
}

/**
 * Validate a parsed object has the required rule shape.
 */
export function validateParsedRule(parsed: unknown): ParsedRuleResult {
  const warnings: string[] = []

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { success: false, error: "AI response is not a JSON object", warnings: [] }
  }

  const obj = parsed as Record<string, unknown>

  // Validate name
  if (!obj.name || typeof obj.name !== "string") {
    return { success: false, error: "AI response missing required 'name' field", warnings: [] }
  }
  const name = obj.name.trim()
  if (!name) {
    return { success: false, error: "AI response has empty 'name' field", warnings: [] }
  }

  // Validate domains
  if (!Array.isArray(obj.domains)) {
    return { success: false, error: "AI response missing required 'domains' array", warnings: [] }
  }

  const { valid, invalid } = sanitizeGeneratedDomains(obj.domains)
  if (invalid.length > 0) {
    warnings.push(`Removed ${invalid.length} invalid pattern(s): ${invalid.join(", ")}`)
  }
  if (valid.length === 0) {
    warnings.push("No valid domain patterns generated")
  }

  // Validate color
  const color = normalizeColor(obj.color)
  if (obj.color && typeof obj.color === "string" && !isValidColor(obj.color.toLowerCase())) {
    warnings.push(`Unknown color "${obj.color}", defaulting to "blue"`)
  }

  return {
    success: true,
    rule: { name, domains: valid, color },
    warnings
  }
}

/**
 * Validate and filter domain patterns using the existing URL pattern matcher.
 */
export function sanitizeGeneratedDomains(domains: unknown[]): {
  valid: string[]
  invalid: string[]
} {
  const valid: string[] = []
  const invalid: string[] = []
  const seen = new Set<string>()

  for (const domain of domains) {
    if (typeof domain !== "string" || !domain.trim()) {
      continue
    }

    const trimmed = domain.trim()
    if (seen.has(trimmed)) {
      continue
    }
    seen.add(trimmed)

    const validation = urlPatternMatcher.validatePattern(trimmed)
    if (validation.isValid) {
      valid.push(trimmed)
    } else {
      invalid.push(trimmed)
    }
  }

  return { valid, invalid }
}

/**
 * Normalize an AI-generated color value to a valid TabGroupColor.
 */
export function normalizeColor(color: unknown): TabGroupColor {
  if (typeof color === "string" && isValidColor(color.toLowerCase())) {
    return color.toLowerCase() as TabGroupColor
  }
  return "blue"
}
