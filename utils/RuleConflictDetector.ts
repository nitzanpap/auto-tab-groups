/**
 * Deterministic conflict detection between rule patterns.
 * Pure functions — no browser API dependencies.
 */

import type { CustomRule, PatternConflict, PatternConflictType } from "../types"

/**
 * Check if two patterns overlap and return the conflict type.
 * Returns null if no overlap is detected.
 */
export function checkPatternOverlap(
  sourcePattern: string,
  targetPattern: string
): PatternConflictType | null {
  const src = sourcePattern.toLowerCase().trim()
  const tgt = targetPattern.toLowerCase().trim()

  // Exact duplicate (case-insensitive)
  if (src === tgt) {
    return "exact_duplicate"
  }

  // Check segment extraction patterns
  const srcIsSegment = src.includes("{") && src.includes("}")
  const tgtIsSegment = tgt.includes("{") && tgt.includes("}")

  if (srcIsSegment || tgtIsSegment) {
    return checkSegmentOverlap(src, tgt, srcIsSegment, tgtIsSegment)
  }

  // Check wildcard subsumption (*.domain vs sub.domain)
  const wildcardResult = checkWildcardSubsumption(src, tgt)
  if (wildcardResult !== null) {
    return wildcardResult
  }

  // Check TLD wildcard overlap (domain.** vs domain.com)
  const tldResult = checkTldWildcardOverlap(src, tgt)
  if (tldResult !== null) {
    return tldResult
  }

  return null
}

/**
 * Detect all conflicts between source patterns and existing rules.
 */
export function detectConflicts(
  sourcePatterns: readonly string[],
  existingRules: readonly CustomRule[],
  excludeRuleId?: string
): PatternConflict[] {
  const conflicts: PatternConflict[] = []

  for (const srcPattern of sourcePatterns) {
    for (const rule of existingRules) {
      if (rule.id === excludeRuleId) continue

      for (const tgtPattern of rule.domains) {
        const conflictType = checkPatternOverlap(srcPattern, tgtPattern)
        if (conflictType !== null) {
          conflicts.push({
            sourcePattern: srcPattern,
            targetPattern: tgtPattern,
            targetRuleId: rule.id,
            targetRuleName: rule.name,
            conflictType,
            description: describeConflict(srcPattern, tgtPattern, conflictType, rule.name)
          })
        }
      }
    }
  }

  return conflicts
}

/**
 * Create a human-readable description for a conflict.
 */
function describeConflict(
  sourcePattern: string,
  targetPattern: string,
  conflictType: PatternConflictType,
  targetRuleName: string
): string {
  switch (conflictType) {
    case "exact_duplicate":
      return `"${sourcePattern}" is already used in rule "${targetRuleName}"`

    case "wildcard_subsumes":
      return `"${sourcePattern}" covers "${targetPattern}" in rule "${targetRuleName}"`

    case "subsumed_by_wildcard":
      return `"${targetPattern}" in rule "${targetRuleName}" already covers "${sourcePattern}"`

    case "tld_wildcard_overlap":
      return `"${sourcePattern}" and "${targetPattern}" in rule "${targetRuleName}" match overlapping domains`

    case "segment_overlap":
      return `"${sourcePattern}" and "${targetPattern}" in rule "${targetRuleName}" match the same subdomains`
  }
}

/**
 * Check wildcard subsumption between two patterns.
 * *.example.com subsumes www.example.com, sub.example.com, etc.
 */
function checkWildcardSubsumption(src: string, tgt: string): PatternConflictType | null {
  // Source is wildcard: *.base → check if target is a subdomain of base
  if (src.startsWith("*.")) {
    const baseDomain = src.slice(2)
    if (isSubdomainOf(tgt, baseDomain)) {
      return "wildcard_subsumes"
    }
  }

  // Target is wildcard: *.base → check if source is a subdomain of base
  if (tgt.startsWith("*.")) {
    const baseDomain = tgt.slice(2)
    if (isSubdomainOf(src, baseDomain)) {
      return "subsumed_by_wildcard"
    }
  }

  return null
}

/**
 * Check if a pattern is a subdomain of a base domain.
 * "www.example.com" is a subdomain of "example.com".
 * "example.com" is NOT a subdomain of "example.com" (exact match, not subdomain).
 */
function isSubdomainOf(pattern: string, baseDomain: string): boolean {
  // Pattern must not be a wildcard itself for this check
  if (pattern.startsWith("*.") || pattern.includes("{")) return false

  // Must end with .baseDomain and have something before the dot
  return pattern.endsWith(`.${baseDomain}`) && pattern.length > baseDomain.length + 1
}

/**
 * Check TLD wildcard overlap between patterns.
 * example.** matches example.com, example.co.uk, etc.
 */
function checkTldWildcardOverlap(src: string, tgt: string): PatternConflictType | null {
  if (src.endsWith(".**")) {
    const baseHost = src.slice(0, -3)
    if (tgt.startsWith(`${baseHost}.`) && !tgt.endsWith(".**")) {
      return "tld_wildcard_overlap"
    }
  }

  if (tgt.endsWith(".**")) {
    const baseHost = tgt.slice(0, -3)
    if (src.startsWith(`${baseHost}.`) && !src.endsWith(".**")) {
      return "tld_wildcard_overlap"
    }
  }

  return null
}

/**
 * Check segment extraction overlap.
 * {sub}.example.com overlaps with *.example.com and specific subdomains.
 */
function checkSegmentOverlap(
  src: string,
  tgt: string,
  srcIsSegment: boolean,
  tgtIsSegment: boolean
): PatternConflictType | null {
  const srcBase = extractBaseDomainFromSegment(srcIsSegment ? src : "")
  const tgtBase = extractBaseDomainFromSegment(tgtIsSegment ? tgt : "")

  // Get the effective base domain to compare
  const srcEffective = srcIsSegment ? srcBase : src
  const tgtEffective = tgtIsSegment ? tgtBase : tgt

  if (!srcEffective || !tgtEffective) return null

  // Segment vs wildcard on same base domain
  if (srcIsSegment && tgt.startsWith("*.")) {
    const wildcardBase = tgt.slice(2)
    if (srcBase === wildcardBase) return "segment_overlap"
  }

  if (tgtIsSegment && src.startsWith("*.")) {
    const wildcardBase = src.slice(2)
    if (tgtBase === wildcardBase) return "segment_overlap"
  }

  // Segment vs specific subdomain on same base domain
  if (srcIsSegment && !tgtIsSegment) {
    if (isSubdomainOf(tgt, srcBase!) || tgt === srcBase) return "segment_overlap"
  }

  if (tgtIsSegment && !srcIsSegment) {
    if (isSubdomainOf(src, tgtBase!) || src === tgtBase) return "segment_overlap"
  }

  // Both are segment patterns on same base domain
  if (srcIsSegment && tgtIsSegment && srcBase === tgtBase) {
    return "segment_overlap"
  }

  return null
}

/**
 * Extract the base domain from a segment pattern.
 * "{sub}.example.com" → "example.com"
 * "{env}-{region}.console.aws.com" → "console.aws.com"
 */
function extractBaseDomainFromSegment(pattern: string): string | null {
  if (!pattern) return null

  // Remove all {variable} parts and leading dots/dashes
  const cleaned = pattern.replace(/\{[^}]+\}/g, "").replace(/^[.-]+/, "")
  return cleaned || null
}
