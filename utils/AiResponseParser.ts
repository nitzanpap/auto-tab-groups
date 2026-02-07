/**
 * Parses and validates AI-generated responses.
 * Pure functions — no browser API dependencies.
 */

import type { AiGroupSuggestion, TabGroupColor } from "../types"
import { isValidColor } from "./Constants"
import { urlPatternMatcher } from "./UrlPatternMatcher"

export interface ParsedSuggestionResult {
  success: boolean
  suggestions: AiGroupSuggestion[]
  error?: string
  warnings: string[]
}

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

/**
 * Try multiple strategies to extract a JSON array string from AI output.
 */
export function extractJsonArrayFromResponse(content: string): string | null {
  const trimmed = content.trim()

  // Strategy 1: Direct parse — content is pure JSON array or single object
  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) return trimmed
    // Small models sometimes return a single object instead of an array — wrap it
    if (parsed && typeof parsed === "object" && parsed.groupName) {
      return JSON.stringify([parsed])
    }
  } catch {
    // Continue to next strategy
  }

  // Strategy 2: Extract from markdown code fence
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenceMatch?.[1]) {
    try {
      const fenceContent = fenceMatch[1].trim()
      const parsed = JSON.parse(fenceContent)
      if (Array.isArray(parsed)) return fenceContent
      if (parsed && typeof parsed === "object" && parsed.groupName) {
        return JSON.stringify([parsed])
      }
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 3: Find first { ... } block (single object — small models often omit the array wrapper)
  // Run this BEFORE bracket search because bracket search can false-positive
  // on tabIndices arrays inside objects (e.g. tabIndices:[1] matches as [1])
  const braceStart = trimmed.indexOf("{")
  const braceEnd = trimmed.lastIndexOf("}")
  if (braceStart !== -1 && braceEnd > braceStart) {
    const candidate = trimmed.slice(braceStart, braceEnd + 1)
    try {
      const parsed = JSON.parse(candidate)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.groupName) {
        return JSON.stringify([parsed])
      }
    } catch {
      // No valid JSON found
    }
  }

  // Strategy 4: Find first [ ... ] block
  const bracketStart = trimmed.indexOf("[")
  const bracketEnd = trimmed.lastIndexOf("]")
  if (bracketStart !== -1 && bracketEnd > bracketStart) {
    const candidate = trimmed.slice(bracketStart, bracketEnd + 1)
    try {
      const parsed = JSON.parse(candidate)
      if (Array.isArray(parsed)) return candidate
    } catch {
      // No valid JSON array found
    }
  }

  // Strategy 5: Multiple separate JSON objects (JSONL-like)
  // Small models sometimes output each object on its own line without array wrapper
  const objectMatches = trimmed.match(/\{[^{}]+\}/g)
  if (objectMatches && objectMatches.length >= 1) {
    const arrayCandidate = `[${objectMatches.join(",")}]`
    try {
      const parsed = JSON.parse(arrayCandidate)
      if (
        Array.isArray(parsed) &&
        parsed.some(obj => obj && typeof obj === "object" && obj.groupName)
      ) {
        return arrayCandidate
      }
    } catch {
      // Could not combine objects
    }
  }

  return null
}

/**
 * Parse raw AI text output into structured tab grouping suggestions.
 * Maps 1-based tabIndices from AI back to actual tab data.
 */
export function parseAiSuggestionResponse(
  rawContent: string,
  tabsWithIds: ReadonlyArray<{ tabId: number; title: string; url: string }>
): ParsedSuggestionResult {
  if (!rawContent || typeof rawContent !== "string") {
    return { success: false, suggestions: [], error: "Empty or invalid AI response", warnings: [] }
  }

  const jsonString = extractJsonArrayFromResponse(rawContent)
  if (!jsonString) {
    return {
      success: false,
      suggestions: [],
      error: "Could not extract JSON array from AI response",
      warnings: []
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonString)
  } catch {
    return {
      success: false,
      suggestions: [],
      error: "AI response contained invalid JSON",
      warnings: []
    }
  }

  if (!Array.isArray(parsed)) {
    return {
      success: false,
      suggestions: [],
      error: "AI response is not a JSON array",
      warnings: []
    }
  }

  const warnings: string[] = []
  const suggestions: AiGroupSuggestion[] = []
  const assignedTabIds = new Set<number>()

  for (const item of parsed) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue
    }

    const obj = item as Record<string, unknown>

    // Validate groupName
    if (!obj.groupName || typeof obj.groupName !== "string" || !obj.groupName.trim()) {
      continue
    }
    // Truncate to max 3 words — small models often generate verbose names
    const words = obj.groupName.trim().split(/\s+/)
    const groupName = words.slice(0, 3).join(" ")

    // Validate tabIndices
    if (!Array.isArray(obj.tabIndices)) {
      continue
    }

    // Map indices to tab data, filtering invalid ones
    const tabs: Array<{ tabId: number; title: string; url: string }> = []
    let outOfRangeCount = 0

    for (const idx of obj.tabIndices) {
      if (typeof idx !== "number" || !Number.isInteger(idx)) {
        continue
      }
      if (idx < 1 || idx > tabsWithIds.length) {
        outOfRangeCount++
        continue
      }
      const tab = tabsWithIds[idx - 1]
      if (assignedTabIds.has(tab.tabId)) {
        continue
      }
      assignedTabIds.add(tab.tabId)
      tabs.push({ tabId: tab.tabId, title: tab.title, url: tab.url })
    }

    if (outOfRangeCount > 0) {
      warnings.push(`"${groupName}": ${outOfRangeCount} out-of-range tab index(es) removed`)
    }

    if (tabs.length === 0) {
      warnings.push(`"${groupName}": skipped — no valid tabs`)
      continue
    }

    // Normalize color
    const color = normalizeColor(obj.color)
    if (obj.color && typeof obj.color === "string" && !isValidColor(obj.color.toLowerCase())) {
      warnings.push(`"${groupName}": unknown color "${obj.color}", defaulting to "blue"`)
    }

    suggestions.push({ groupName, color, tabs })
  }

  if (suggestions.length === 0) {
    return {
      success: false,
      suggestions: [],
      error: "No valid suggestions could be parsed from AI response",
      warnings
    }
  }

  return { success: true, suggestions, warnings }
}
