/**
 * Structured prompt builders for AI features (Phase 2+)
 * Pure functions returning AiChatMessage arrays.
 */

import type { AiChatMessage, PatternConflict } from "../types"

/**
 * Build a prompt for generating custom grouping rules from a natural language description
 */
export function ruleGenerationPrompt(
  description: string,
  existingDomains: string[]
): AiChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a browser tab organization assistant.",
        "Given a user's description, output a JSON object for a custom tab grouping rule.",
        "The JSON must have exactly these fields:",
        '- name: string (1-3 words max, e.g. "Google", "Dev Tools", "Social Media")',
        '- domains: string[] (use specific domains like "github.com", not broad wildcards like "*.google.com" unless the user truly wants ALL subdomains)',
        "- color: string (one of: grey, blue, red, yellow, green, pink, purple, cyan, orange)",
        "",
        'Example input: "Group browser extension stores"',
        'Example output: {"name":"Extensions","domains":["chromewebstore.google.com","addons.mozilla.org"],"color":"purple"}',
        "",
        "Only output the JSON object. No markdown, no explanation, no extra text."
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `Description: ${description}`,
        existingDomains.length > 0
          ? `Currently open domains for context: ${existingDomains.join(", ")}`
          : ""
      ]
        .filter(Boolean)
        .join("\n")
    }
  ]
}

/**
 * JSON Schema for tab grouping suggestions.
 * Forces the model to produce the exact object structure at the grammar level.
 */
export const SUGGESTION_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    groups: {
      type: "array",
      items: {
        type: "object",
        properties: {
          groupName: { type: "string" },
          tabIndices: { type: "array", items: { type: "integer" } },
          color: { type: "string" }
        },
        required: ["groupName", "tabIndices", "color"]
      }
    }
  },
  required: ["groups"]
})

/**
 * Build a prompt for suggesting tab group assignments based on open tabs
 */
export function tabGroupSuggestionPrompt(
  tabs: ReadonlyArray<{ title: string; url: string }>
): AiChatMessage[] {
  const tabList = tabs
    .map((t, i) => {
      let domain = t.url
      try {
        domain = new URL(t.url).hostname
      } catch {
        // Keep raw URL as fallback
      }
      return `${i + 1}. [${domain}] "${t.title}"`
    })
    .join("\n")

  return [
    {
      role: "system",
      content: [
        "You organize browser tabs into groups by topic or purpose.",
        'Output a JSON object: {"groups":[...]} where each element has groupName (1-3 words), tabIndices (1-based tab numbers), color (one of: grey, blue, red, yellow, green, pink, purple, cyan, orange).',
        "Group by TOPIC, not by website. Tabs about the same subject from different sites belong together.",
        "Use descriptive category names like 'Dev Tools', 'Shopping', 'Streaming' — not website names like 'Amazon' or 'GitHub'.",
        "",
        "Example:",
        'Input: 1. [reddit.com] "Best hiking trails" 2. [alltrails.com] "Mount Tam Loop" 3. [youtube.com] "Cooking pasta" 4. [reddit.com] "Easy dinner recipes"',
        'Output: {"groups":[{"groupName":"Hiking","tabIndices":[1,2],"color":"green"},{"groupName":"Cooking","tabIndices":[3,4],"color":"orange"}]}',
        "",
        "Rules: every tab in exactly one group, short names (1-3 words), JSON only."
      ].join("\n")
    },
    {
      role: "user",
      content: `Organize these tabs:\n${tabList}`
    }
  ]
}

/**
 * Build a prompt for explaining what a tab's content is about
 */
export function tabExplainerPrompt(title: string, url: string): AiChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are a concise assistant. Given a tab's title and URL, describe in one sentence what the page is about."
    },
    {
      role: "user",
      content: `Title: "${title}"\nURL: ${url}`
    }
  ]
}

/**
 * Build a prompt for AI to suggest resolutions for rule pattern conflicts.
 */
export function conflictResolutionPrompt(
  ruleName: string,
  rulePatterns: readonly string[],
  conflicts: readonly PatternConflict[],
  conflictingRules: ReadonlyArray<{ name: string; domains: readonly string[] }>
): AiChatMessage[] {
  const conflictList = conflicts
    .map(
      c =>
        `- "${c.sourcePattern}" overlaps with "${c.targetPattern}" in rule "${c.targetRuleName}" (${c.conflictType})`
    )
    .join("\n")

  const existingRulesList = conflictingRules
    .map(r => `- "${r.name}": ${r.domains.join(", ")}`)
    .join("\n")

  return [
    {
      role: "system",
      content: [
        "You are a browser tab grouping rule analyst.",
        "Given a new rule and its conflicts with existing rules, suggest resolutions.",
        'Output a JSON object: {"resolutions":[...]} where each resolution is a string describing one actionable suggestion.',
        "Possible actions: merge rules into one, adjust patterns to be more specific, or ignore if the overlap is intentional.",
        "Keep each suggestion to one sentence. Be specific about which patterns or rules to change.",
        "Output only the JSON object."
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `New rule: "${ruleName}" with patterns: ${rulePatterns.join(", ")}`,
        "",
        "Conflicts detected:",
        conflictList,
        "",
        "Existing rules involved:",
        existingRulesList
      ].join("\n")
    }
  ]
}
