/**
 * Single Source of Truth for URL Pattern Matching
 * Handles all URL pattern matching logic for the extension
 */

import type { PatternValidationResult } from "../types"

/**
 * Pattern type identifiers
 */
export const PATTERN_TYPES = {
  SIMPLE_WILDCARD: "simple_wildcard",
  SEGMENT_EXTRACTION: "segment_extraction",
  REGEX: "regex",
  TITLE: "title"
} as const

export type PatternType = (typeof PATTERN_TYPES)[keyof typeof PATTERN_TYPES]

/**
 * Match result from pattern matching
 */
export interface MatchResult {
  matched: boolean
  extractedValues: Record<string, string>
  groupName: string | null
}

/**
 * Matching options
 */
export interface MatchOptions {
  ruleName?: string
  groupNameTemplate?: string
  allowAutoSubdomain?: boolean
  /** The tab's title, needed by "title:" patterns and ignored by the rest */
  title?: string
}

/** Prefix that switches a pattern from matching the URL to matching the title */
export const TITLE_PATTERN_PREFIX = "title:"

/**
 * Most wildcards and variables one extraction pattern may contain.
 *
 * Measured cost of one match against a 60-character URL: 4 wildcards 3ms,
 * 5 wildcards 31ms, 6 wildcards 285ms, 7 wildcards 2.3s. Real patterns use
 * two or three ("*.reddit.com/r/{subreddit}/comments/*" is three), so 4 is
 * both room to work and a ceiling on what a hostile rules file can cost.
 */
const MAX_EXTRACTION_WILDCARDS = 4

/** A single match this slow means the pattern, not the machine, is the problem */
const SLOW_MATCH_MS = 250

/** Budget for the validation probe below */
const SLOW_PROBE_MS = 25

/**
 * Pattern validation result with type
 */
export interface PatternValidationResultWithType extends PatternValidationResult {
  type: PatternType | null
}

/**
 * Variable specification from segment extraction patterns
 */
interface VariableSpec {
  name: string
  type: string
  delimiter: string | null
}

/**
 * Pattern part (literal or variable)
 */
interface PatternPart {
  type: "literal" | "variable"
  value: string | VariableSpec
}

/**
 * Parsed segment pattern info
 */
interface SegmentPatternInfo {
  valid: boolean
  variables: VariableSpec[]
  parts: PatternPart[]
  originalPattern: string
}

class UrlPatternMatcher {
  /** Regex patterns caught taking too long, skipped until the worker restarts */
  private slowPatterns = new Set<string>()

  /**
   * Main entry point - matches a URL against a pattern
   */
  match(url: string, pattern: string, options: MatchOptions = {}): MatchResult {
    if (!pattern || (!url && !this.isTitlePattern(pattern))) {
      return { matched: false, extractedValues: {}, groupName: null }
    }

    // Exclusion patterns must be handled by the caller (RulesService).
    // If one slips through, treat as non-match to avoid false positives.
    if (this.isExclusionPattern(pattern)) {
      return { matched: false, extractedValues: {}, groupName: null }
    }

    const patternType = this.detectPatternType(pattern)

    switch (patternType) {
      case PATTERN_TYPES.TITLE:
        return this.matchTitle(options.title || "", pattern, options)
      case PATTERN_TYPES.SEGMENT_EXTRACTION:
        return this.matchSegmentExtraction(url, pattern, options)
      case PATTERN_TYPES.REGEX:
        return this.matchRegex(url, pattern, options)
      default:
        return this.matchSimpleWildcard(url, pattern, options)
    }
  }

  /**
   * Detects the type of pattern
   */
  detectPatternType(pattern: string): PatternType {
    // A "title:" prefix decides what the pattern is matched against, so it
    // wins over the syntax checks below — a title may contain anything
    if (this.isTitlePattern(pattern)) {
      return PATTERN_TYPES.TITLE
    }

    // Check for segment extraction patterns (contains {variable})
    if (/\{[^}]+\}/.test(pattern)) {
      return PATTERN_TYPES.SEGMENT_EXTRACTION
    }

    // Check for regex patterns (starts and ends with /)
    if (pattern.startsWith("/") && pattern.endsWith("/")) {
      return PATTERN_TYPES.REGEX
    }

    // Default to simple wildcard
    return PATTERN_TYPES.SIMPLE_WILDCARD
  }

  /**
   * Wildcard matching without a regex.
   *
   * "a*b*c" compiled to /a[^/]*b[^/]*c/ backtracks exponentially in the number
   * of wildcards: twenty of them against a sixty-character URL took over a
   * minute here, with the service worker blocked for all of it. Patterns are
   * not only typed by the person using them — they arrive in imported rules
   * files too — so a pattern's cost must not depend on who wrote it.
   *
   * This is the textbook two-pointer glob: on a mismatch it hands one more
   * character to the last "*" and carries on, which visits each character at
   * most once per wildcard instead of exploring every split.
   *
   * @param separator a character "*" may never swallow (path "/", host ".")
   * @param fullMatch whether the pattern must consume the whole text
   */
  private globMatch(text: string, pattern: string, separator: string, fullMatch: boolean): boolean {
    let textIndex = 0
    let patternIndex = 0
    let lastStar = -1
    let starTextIndex = 0

    while (textIndex < text.length) {
      if (!fullMatch && patternIndex === pattern.length) return true

      if (pattern[patternIndex] === "*") {
        lastStar = patternIndex
        starTextIndex = textIndex
        patternIndex++
      } else if (patternIndex < pattern.length && pattern[patternIndex] === text[textIndex]) {
        textIndex++
        patternIndex++
      } else if (lastStar !== -1) {
        // Give the last "*" one more character — unless that character is the
        // separator, which no single "*" is allowed to cross
        if (text[starTextIndex] === separator) return false
        starTextIndex++
        textIndex = starTextIndex
        patternIndex = lastStar + 1
      } else {
        return false
      }
    }

    while (patternIndex < pattern.length && pattern[patternIndex] === "*") patternIndex++
    return patternIndex === pattern.length
  }

  /**
   * Whether a user's regex backtracks catastrophically.
   *
   * A regex is the one pattern type that cannot be made safe by rewriting the
   * matcher — it is the user's own program, and JavaScript cannot interrupt one
   * mid-run. So it is measured instead: exponential backtracking is already
   * obvious on a short string (a few million steps), while any sane regex
   * finishes a twenty-character probe in microseconds. Short probes are what
   * keep this check itself cheap — the same regex on sixty characters would
   * take hours.
   *
   * Catches the classic shapes, not every possible one. Patterns that slip
   * through are quarantined by matchRegex() after their first slow run.
   */
  private backtracksBadly(regex: RegExp): boolean {
    const probes = [`${"a".repeat(20)}!`, `${"ab".repeat(10)}!`, `${"a-".repeat(10)}!`]
    const started = performance.now()

    for (const probe of probes) {
      try {
        regex.test(probe)
      } catch {
        return false
      }
      if (performance.now() - started > SLOW_PROBE_MS) return true
    }

    return false
  }

  /**
   * Whether a pattern addresses the tab's title rather than its URL.
   */
  isTitlePattern(pattern: string): boolean {
    return pattern.trim().toLowerCase().startsWith(TITLE_PATTERN_PREFIX)
  }

  /** The pattern with its "title:" prefix removed */
  private titleSpec(pattern: string): string {
    return pattern.trim().substring(TITLE_PATTERN_PREFIX.length).trim()
  }

  /**
   * Matches a tab title against a "title:" pattern (#98).
   *
   * Titles are prose, not structure: they carry spaces, dashes and dots that
   * mean nothing, so this has none of the URL matchers' segment rules. The
   * text has to appear somewhere in the title and "*" stands for any run of
   * characters. Everything else, braces included, is literal.
   *
   * ponytail: no {variable} capture here — "{channel} - YouTube" has no single
   * right answer on "Video - Channel - YouTube", and guessing one would name
   * people's groups wrong. Titles name their group after the rule; the URL
   * matchers keep extraction, where the structure makes it unambiguous.
   */
  matchTitle(title: string, pattern: string, options: MatchOptions = {}): MatchResult {
    const noMatch: MatchResult = { matched: false, extractedValues: {}, groupName: null }

    const spec = this.titleSpec(pattern)
    if (!title || !spec) return noMatch

    // Scanned rather than turned into a regex: "*a*a*a…" compiles to a regex
    // that backtracks exponentially, and rules arrive from imported files as
    // well as from the person using them. indexOf walks the title once per
    // literal, so a hostile pattern costs no more than a sensible one.
    const haystack = title.toLowerCase()
    const literals = spec.toLowerCase().split("*")
    let cursor = 0

    for (const literal of literals) {
      if (!literal) continue

      const found = haystack.indexOf(literal, cursor)
      if (found === -1) return noMatch

      cursor = found + literal.length
    }

    return {
      matched: true,
      extractedValues: {},
      groupName: options.groupNameTemplate || options.ruleName || null
    }
  }

  /**
   * Rewrites "host?query" as "host/*query" (#98).
   *
   * A query written straight after the host has no path to live in, so the
   * host half used to swallow it and the pattern was rejected for containing
   * "?" and "=". Reading it as "anywhere on this host" is both what people
   * mean by it and what the documented "host/*key=value" form already does —
   * the leading "*" is why parameter order does not matter.
   */
  private normalizeQueryOnlyPattern(pattern: string): string {
    const questionMark = pattern.indexOf("?")
    if (questionMark === -1) return pattern

    const slash = pattern.indexOf("/")
    if (slash !== -1 && slash < questionMark) return pattern

    return `${pattern.substring(0, questionMark)}/*${pattern.substring(questionMark + 1)}`
  }

  /**
   * The hostname, then the same hostname with leading subdomains dropped when
   * the caller allows it.
   *
   * RulesService retries every rule with allowAutoSubdomain so "youtube.com"
   * reaches "www.youtube.com". The wildcard matcher has always honoured that;
   * extraction patterns silently did not, so the same rule text matched
   * different hosts depending on which pattern type it happened to be (#98).
   */
  private candidateHostnames(hostname: string, options: MatchOptions): string[] {
    if (!options.allowAutoSubdomain) return [hostname]

    const hosts = [hostname]
    const labels = hostname.split(".")
    for (let i = 1; labels.length - i >= 2; i++) {
      hosts.push(labels.slice(i).join("."))
    }
    return hosts
  }

  /**
   * Candidate strings to match a pattern against, query string and hash last.
   *
   * The query and hash are tried only after the plain hostname/path has failed,
   * which keeps this purely additive: a pattern that matched before still
   * matches the same text with the same capture groups, and only patterns that
   * need them see them. Case is preserved so extracted values (a ticket id,
   * say) keep theirs when they become a group name.
   */
  private matchTargets(urlObj: URL, base: string, lowercase = false): string[] {
    // The wildcard matcher lowercases its pattern and path, so the query and
    // hash have to be lowercased too. The extraction matchers keep case,
    // because their captures become group titles.
    const search = lowercase ? urlObj.search.toLowerCase() : urlObj.search
    const hash = lowercase ? urlObj.hash.toLowerCase() : urlObj.hash

    const targets = [base]
    if (search) targets.push(base + search)
    // Hash routing (example.com/app/#/admin) puts the meaningful path after #
    if (hash) {
      targets.push(base + hash)
      if (search) targets.push(base + search + hash)
    }
    return targets
  }

  /**
   * Matches using simple wildcard patterns
   */
  matchSimpleWildcard(url: string, pattern: string, options: MatchOptions = {}): MatchResult {
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname.toLowerCase()
      const pathname = urlObj.pathname.toLowerCase()
      const cleanPattern = this.normalizeQueryOnlyPattern(pattern.toLowerCase().trim())

      // Check if pattern includes a path
      const hasPath = cleanPattern.includes("/")
      // Split only on first "/" to separate domain from full path
      const firstSlashIndex = cleanPattern.indexOf("/")
      const fullDomainPattern = hasPath ? cleanPattern.substring(0, firstSlashIndex) : cleanPattern
      const pathPattern = hasPath ? cleanPattern.substring(firstSlashIndex + 1) : ""

      // Split domain from optional port (e.g., "localhost:3000")
      const { domainPattern, portPattern } = this.splitDomainPort(fullDomainPattern)

      // Match domain part
      const domainMatch = this.matchDomainWildcard(hostname, domainPattern, options)
      if (!domainMatch) {
        return { matched: false, extractedValues: {}, groupName: null }
      }

      // Match port if pattern specifies one
      if (portPattern && !this.matchPort(urlObj.port, portPattern, urlObj.protocol)) {
        return { matched: false, extractedValues: {}, groupName: null }
      }

      // Match path part if specified
      if (hasPath) {
        const targets = this.matchTargets(urlObj, pathname, true)
        if (!targets.some(target => this.matchPathWildcard(target, pathPattern))) {
          return { matched: false, extractedValues: {}, groupName: null }
        }
      }

      return {
        matched: true,
        extractedValues: {},
        groupName: options.ruleName || null
      }
    } catch {
      return { matched: false, extractedValues: {}, groupName: null }
    }
  }

  /**
   * Matches domain with wildcard support
   */
  matchDomainWildcard(domain: string, pattern: string, options: MatchOptions = {}): boolean {
    if (!domain || !pattern) return false

    const cleanDomain = domain.toLowerCase().trim()
    const cleanPattern = pattern.toLowerCase().trim()

    // Handle lone * — matches any domain
    if (cleanPattern === "*") return true

    // Handle ** wildcard for TLD (e.g., google.** matches google.com)
    if (cleanPattern.includes("**")) {
      const parts = cleanPattern.split("**")
      if (parts.length !== 2) return false

      const prefix = parts[0]
      const suffix = parts[1]

      if (!cleanDomain.startsWith(prefix)) return false
      if (suffix && !cleanDomain.endsWith(suffix)) return false

      const remainder = cleanDomain.substring(prefix.length)
      if (suffix) {
        const beforeSuffix = remainder.substring(0, remainder.length - suffix.length)
        return beforeSuffix.length > 0 && /^[a-zA-Z0-9.-]+$/.test(beforeSuffix)
      }
      return remainder.length > 0 && /^[a-zA-Z0-9.-]+$/.test(remainder)
    }

    // Handle * wildcard for subdomains (*.domain.com)
    // Only applies when base domain is a literal (no wildcards)
    // For patterns like *.*.*.*, fall through to middle wildcard handler
    if (cleanPattern.startsWith("*.")) {
      const baseDomain = cleanPattern.substring(2)

      if (baseDomain && !baseDomain.includes("*") && baseDomain.includes(".")) {
        // Check for exact match or subdomain match
        return cleanDomain === baseDomain || cleanDomain.endsWith(`.${baseDomain}`)
      }
    }

    // Handle wildcard patterns (including patterns starting with * like *.*.*.*)
    if (cleanPattern.includes("*")) {
      return this.matchMiddleWildcard(cleanDomain, cleanPattern)
    }

    // Exact match
    if (cleanDomain === cleanPattern) return true

    // Auto-match any subdomain (only if enabled)
    if (options.allowAutoSubdomain && cleanDomain.endsWith(`.${cleanPattern}`)) return true

    return false
  }

  /**
   * Matches patterns with wildcards in the middle
   */
  matchMiddleWildcard(domain: string, pattern: string): boolean {
    return this.globMatch(domain, pattern, ".", true)
  }

  /**
   * Matches path with wildcard support
   */
  matchPathWildcard(path: string, pattern: string): boolean {
    if (!pattern) return true

    const cleanPath = path.startsWith("/") ? path.substring(1) : path
    const cleanPattern = pattern.startsWith("/") ? pattern.substring(1) : pattern

    // Handle ** wildcard in path (match any number of segments)
    if (cleanPattern.includes("**")) {
      const parts = cleanPattern.split("**")
      if (parts.length !== 2) return false

      const prefix = parts[0]
      const suffix = parts[1]

      if (prefix && !cleanPath.startsWith(prefix)) return false
      if (suffix && !cleanPath.endsWith(suffix)) return false

      return true
    }

    // Handle single * wildcard in path segments (match single segment)
    if (cleanPattern.includes("*")) {
      // Prefix match: the pattern has to be satisfied, the path may continue
      return this.globMatch(cleanPath, cleanPattern, "/", false)
    }

    // Exact prefix matching
    return cleanPath.startsWith(cleanPattern)
  }

  /**
   * Matches using segment extraction patterns
   */
  matchSegmentExtraction(url: string, pattern: string, options: MatchOptions = {}): MatchResult {
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname.toLowerCase()
      const pathname = urlObj.pathname

      const patternInfo = this.parseSegmentPattern(pattern)
      if (!patternInfo.valid) {
        return { matched: false, extractedValues: {}, groupName: null }
      }

      const regex = this.buildSegmentRegex(patternInfo)

      let match: RegExpMatchArray | null = null
      for (const host of this.candidateHostnames(hostname, options)) {
        const base = pattern.includes("/") ? host + pathname : host
        for (const target of this.matchTargets(urlObj, base)) {
          match = target.match(regex)
          if (match) break
        }
        if (match) break
      }

      if (!match) {
        return { matched: false, extractedValues: {}, groupName: null }
      }

      const extractedValues: Record<string, string> = {}
      patternInfo.variables.forEach((variable, index) => {
        extractedValues[variable.name] = match[index + 1]
      })

      const groupName = this.generateGroupName(patternInfo, extractedValues, options)

      return {
        matched: true,
        extractedValues,
        groupName
      }
    } catch {
      return { matched: false, extractedValues: {}, groupName: null }
    }
  }

  /**
   * Parses a segment extraction pattern
   */
  parseSegmentPattern(pattern: string): SegmentPatternInfo {
    const variables: VariableSpec[] = []
    const parts: PatternPart[] = []
    let currentPart = ""
    let inVariable = false
    let variableName = ""

    for (let i = 0; i < pattern.length; i++) {
      const char = pattern[i]

      if (char === "{" && !inVariable) {
        if (currentPart) {
          parts.push({ type: "literal", value: currentPart })
          currentPart = ""
        }
        inVariable = true
        variableName = ""
      } else if (char === "}" && inVariable) {
        if (variableName) {
          const variable = this.parseVariableSpec(variableName)
          variables.push(variable)
          parts.push({ type: "variable", value: variable })
        }
        inVariable = false
      } else if (inVariable) {
        variableName += char
      } else {
        currentPart += char
      }
    }

    if (currentPart) {
      parts.push({ type: "literal", value: currentPart })
    }

    return {
      valid: !inVariable && variables.length > 0,
      variables,
      parts,
      originalPattern: pattern
    }
  }

  /**
   * Parses a variable specification
   */
  parseVariableSpec(spec: string): VariableSpec {
    const parts = spec.split(":")
    const name = parts[0]
    const type = parts[1] || "segment"
    const delimiter = parts[2] || null

    return { name, type, delimiter }
  }

  /**
   * Builds a regex from a parsed segment pattern
   */
  buildSegmentRegex(patternInfo: SegmentPatternInfo): RegExp {
    let regexStr = "^"

    for (const part of patternInfo.parts) {
      if (part.type === "literal") {
        let literal = (part.value as string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        literal = literal.replace(/\\\*/g, "[^.]*")
        regexStr += literal
      } else if (part.type === "variable") {
        const variable = part.value as VariableSpec
        // "&" and "#" end a value wherever it sits: without them a capture in
        // a query string runs on into the parameters after it (#98)
        if (variable.delimiter === "dash") {
          regexStr += "([^-&#]+)"
        } else {
          regexStr += "([^.&#]+)"
        }
      }
    }

    // A pattern that ends inside a query string addresses one parameter, so
    // whatever follows the one it captured is none of its business (#98)
    regexStr += "(?:[&#].*)?$"
    return new RegExp(regexStr, "i")
  }

  /**
   * Generates a group name from extracted values
   */
  generateGroupName(
    patternInfo: SegmentPatternInfo,
    extractedValues: Record<string, string>,
    options: MatchOptions
  ): string {
    return this.groupNameFor(extractedValues, patternInfo.variables[0]?.name, options)
  }

  /**
   * The group name for a set of captures: the template if there is one, else
   * the first captured value, else the rule's own name.
   */
  private groupNameFor(
    extractedValues: Record<string, string>,
    firstVariableName: string | undefined,
    options: MatchOptions
  ): string {
    if (options.groupNameTemplate) {
      let groupName = options.groupNameTemplate
      for (const [key, value] of Object.entries(extractedValues)) {
        groupName = groupName.replace(`{${key}}`, value)
      }
      return groupName
    }

    if (firstVariableName && extractedValues[firstVariableName]) {
      return extractedValues[firstVariableName]
    }

    return options.ruleName || "Extracted Group"
  }

  /**
   * Matches using regex patterns
   */
  matchRegex(url: string, pattern: string, options: MatchOptions = {}): MatchResult {
    // Rules saved before the validation probe existed, or slow only on certain
    // URLs, get one bad run and are then left out of every later match. In
    // memory on purpose: a service worker restart is a fair second chance, and
    // a rule the user has since fixed should not stay broken forever.
    if (this.slowPatterns.has(pattern)) {
      return { matched: false, extractedValues: {}, groupName: null }
    }

    try {
      const regexStr = pattern.slice(1, -1)
      const regex = new RegExp(regexStr, "i")

      const urlObj = new URL(url)
      const started = performance.now()

      let match: RegExpMatchArray | null = null
      for (const target of this.matchTargets(urlObj, urlObj.hostname + urlObj.pathname)) {
        match = target.match(regex)
        if (match) break
      }

      if (performance.now() - started > SLOW_MATCH_MS) {
        console.warn(
          `[UrlPatternMatcher] Pattern "${pattern}" took too long to match and will be skipped`
        )
        this.slowPatterns.add(pattern)
      }

      if (!match) {
        return { matched: false, extractedValues: {}, groupName: null }
      }

      const extractedValues: Record<string, string> = {}
      if (match.length > 1) {
        for (let i = 1; i < match.length; i++) {
          extractedValues[`group${i}`] = match[i]
        }
      }

      const groupName = match[1] || options.ruleName || null

      return {
        matched: true,
        extractedValues,
        groupName
      }
    } catch {
      return { matched: false, extractedValues: {}, groupName: null }
    }
  }

  /**
   * Validates a pattern
   */
  validatePattern(pattern: string): PatternValidationResultWithType {
    if (!pattern || typeof pattern !== "string") {
      return {
        isValid: false,
        error: "Pattern must be a non-empty string",
        type: null
      }
    }

    const cleanPattern = pattern.trim()
    if (cleanPattern.length === 0) {
      return { isValid: false, error: "Pattern cannot be empty", type: null }
    }

    if (cleanPattern.length > 500) {
      return {
        isValid: false,
        error: "Pattern too long (max 500 characters)",
        type: null
      }
    }

    // Strip negation prefix before validating the inner pattern
    const inner = cleanPattern.startsWith("!") ? cleanPattern.substring(1) : cleanPattern

    if (inner.length === 0) {
      return { isValid: false, error: "Exclusion pattern cannot be empty after '!'", type: null }
    }

    const patternType = this.detectPatternType(inner)

    switch (patternType) {
      case PATTERN_TYPES.TITLE:
        return this.titleSpec(inner)
          ? { isValid: true, error: null, type: PATTERN_TYPES.TITLE }
          : {
              isValid: false,
              error: "Title pattern cannot be empty after 'title:'",
              type: PATTERN_TYPES.TITLE
            }
      case PATTERN_TYPES.SEGMENT_EXTRACTION:
        return this.validateSegmentPattern(inner)
      case PATTERN_TYPES.REGEX:
        return this.validateRegexPattern(inner)
      default:
        return this.validateSimpleWildcardPattern(inner)
    }
  }

  /**
   * Checks if a pattern is an exclusion (negation) pattern
   */
  isExclusionPattern(pattern: string): boolean {
    return pattern.trim().startsWith("!")
  }

  /**
   * Splits a domain pattern into domain and optional port parts.
   * Handles patterns like "localhost:3000", "*.example.com:8080", "*:3000".
   */
  splitDomainPort(pattern: string): { domainPattern: string; portPattern: string | null } {
    // No colon means no port
    if (!pattern.includes(":")) {
      return { domainPattern: pattern, portPattern: null }
    }

    const lastColon = pattern.lastIndexOf(":")
    const beforeColon = pattern.substring(0, lastColon)
    const afterColon = pattern.substring(lastColon + 1)

    // If afterColon looks like a port (digits or wildcard *), treat as port
    if (/^\d+$/.test(afterColon) || afterColon === "*") {
      return { domainPattern: beforeColon, portPattern: afterColon }
    }

    // Otherwise treat the whole thing as a domain (e.g. IPv6-like patterns)
    return { domainPattern: pattern, portPattern: null }
  }

  /**
   * Matches a URL port against a pattern port.
   * Handles default ports (80 for HTTP, 443 for HTTPS) where urlObj.port is "".
   */
  matchPort(urlPort: string, patternPort: string, protocol: string): boolean {
    if (patternPort === "*") return true

    // Resolve the effective URL port (default ports are "" in URL API)
    const effectiveUrlPort =
      urlPort || (protocol === "https:" ? "443" : protocol === "http:" ? "80" : "")

    return effectiveUrlPort === patternPort
  }

  /**
   * Validates a simple wildcard pattern
   */
  validateSimpleWildcardPattern(rawPattern: string): PatternValidationResultWithType {
    const pattern = this.normalizeQueryOnlyPattern(rawPattern)
    const hasPath = pattern.includes("/")
    const [fullDomainPattern, pathPattern] = hasPath ? pattern.split("/", 2) : [pattern, ""]

    if (!fullDomainPattern) {
      return {
        isValid: false,
        error: "Domain pattern cannot be empty",
        type: PATTERN_TYPES.SIMPLE_WILDCARD
      }
    }

    // Split domain from optional port (e.g., "localhost:3000" → "localhost" + "3000")
    const { domainPattern, portPattern } = this.splitDomainPort(fullDomainPattern)

    // Validate port if present
    if (portPattern !== null && portPattern !== "*") {
      const portNum = Number(portPattern)
      if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
        return {
          isValid: false,
          error: "Port must be a number between 1 and 65535",
          type: PATTERN_TYPES.SIMPLE_WILDCARD
        }
      }
    }

    if (!domainPattern) {
      return {
        isValid: false,
        error: "Domain pattern cannot be empty",
        type: PATTERN_TYPES.SIMPLE_WILDCARD
      }
    }

    if (domainPattern.includes("***")) {
      return {
        isValid: false,
        error: "Invalid wildcard pattern (too many asterisks)",
        type: PATTERN_TYPES.SIMPLE_WILDCARD
      }
    }

    // Reject wildcards after ** (e.g., docs.**.* ) — ** must be the final segment
    if (domainPattern.includes("**")) {
      const afterDoubleStar = domainPattern.split("**")[1]
      if (afterDoubleStar && /[*]/.test(afterDoubleStar)) {
        return {
          isValid: false,
          error: `Cannot use wildcards after **, use ${domainPattern.split("**")[0]}** instead`,
          type: PATTERN_TYPES.SIMPLE_WILDCARD
        }
      }
    }

    if (!/^[a-zA-Z0-9.*-]+$/.test(domainPattern)) {
      return {
        isValid: false,
        error: "Domain pattern contains invalid characters",
        type: PATTERN_TYPES.SIMPLE_WILDCARD
      }
    }

    // ?, = and & are allowed so a pattern can address a query string, # a hash
    if (hasPath && pathPattern && !/^[a-zA-Z0-9._/*?=&%+~:,#-]*$/.test(pathPattern)) {
      return {
        isValid: false,
        error: "Path pattern contains invalid characters",
        type: PATTERN_TYPES.SIMPLE_WILDCARD
      }
    }

    return { isValid: true, error: null, type: PATTERN_TYPES.SIMPLE_WILDCARD }
  }

  /**
   * Validates a segment extraction pattern
   */
  validateSegmentPattern(pattern: string): PatternValidationResultWithType {
    // Extraction still goes through a regex, because the captures are the
    // point, and that regex backtracks exponentially in the number of
    // wildcards and variables: twenty of them took over a minute. Nothing
    // legible needs more than a handful, so the count is where it is stopped.
    const wildcards = (pattern.match(/\*/g) || []).length + (pattern.match(/\{/g) || []).length
    if (wildcards > MAX_EXTRACTION_WILDCARDS) {
      return {
        isValid: false,
        error: `Pattern has too many wildcards and variables (max ${MAX_EXTRACTION_WILDCARDS})`,
        type: PATTERN_TYPES.SEGMENT_EXTRACTION
      }
    }

    const info = this.parseSegmentPattern(pattern)

    if (!info.valid) {
      return {
        isValid: false,
        error: "Invalid segment pattern syntax",
        type: PATTERN_TYPES.SEGMENT_EXTRACTION
      }
    }

    if (info.variables.length === 0) {
      return {
        isValid: false,
        error: "Pattern must contain at least one {variable}",
        type: PATTERN_TYPES.SEGMENT_EXTRACTION
      }
    }

    const names = info.variables.map(v => v.name)
    if (new Set(names).size !== names.length) {
      return {
        isValid: false,
        error: "Duplicate variable names in pattern",
        type: PATTERN_TYPES.SEGMENT_EXTRACTION
      }
    }

    for (const variable of info.variables) {
      if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(variable.name)) {
        return {
          isValid: false,
          error: `Invalid variable name: ${variable.name}`,
          type: PATTERN_TYPES.SEGMENT_EXTRACTION
        }
      }
    }

    return {
      isValid: true,
      error: null,
      type: PATTERN_TYPES.SEGMENT_EXTRACTION
    }
  }

  /**
   * Validates a regex pattern
   */
  validateRegexPattern(pattern: string): PatternValidationResultWithType {
    if (!pattern.startsWith("/") || !pattern.endsWith("/")) {
      return {
        isValid: false,
        error: "Regex pattern must start and end with /",
        type: PATTERN_TYPES.REGEX
      }
    }

    const regexStr = pattern.slice(1, -1)
    if (regexStr.length === 0) {
      return {
        isValid: false,
        error: "Regex pattern cannot be empty",
        type: PATTERN_TYPES.REGEX
      }
    }

    try {
      const regex = new RegExp(regexStr)

      if (this.backtracksBadly(regex)) {
        return {
          isValid: false,
          error: "Regex is too slow to run on every tab — avoid nested quantifiers",
          type: PATTERN_TYPES.REGEX
        }
      }

      return { isValid: true, error: null, type: PATTERN_TYPES.REGEX }
    } catch (error) {
      return {
        isValid: false,
        error: `Invalid regex: ${error instanceof Error ? error.message : "Unknown error"}`,
        type: PATTERN_TYPES.REGEX
      }
    }
  }

  /**
   * Gets pattern type display name for UI
   */
  getPatternTypeDisplayName(patternType: PatternType): string {
    switch (patternType) {
      case PATTERN_TYPES.SEGMENT_EXTRACTION:
        return "Segment Extraction"
      case PATTERN_TYPES.REGEX:
        return "Regular Expression"
      default:
        return "Simple Wildcard"
    }
  }

  /**
   * Gets help text for a pattern type
   */
  getPatternHelp(patternType: PatternType): string {
    switch (patternType) {
      case PATTERN_TYPES.SEGMENT_EXTRACTION:
        return "Use {variable} to extract segments. Example: {accountId}-*.{region}.console.aws.amazon.com"
      case PATTERN_TYPES.REGEX:
        return "Advanced regex patterns. Example: /^(\\d+)-.*\\.(\\w+)\\.console\\.aws\\.amazon\\.com$/"
      default:
        return "Use * for single segment, ** for multiple segments. Examples: *.example.com, domain.**, prefix-*.suffix.com"
    }
  }
}

// Export singleton instance
export const urlPatternMatcher = new UrlPatternMatcher()
