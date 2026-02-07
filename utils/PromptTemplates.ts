/**
 * Structured prompt builders for AI features (Phase 2+)
 * Pure functions returning AiChatMessage arrays.
 */

import type { AiChatMessage } from "../types"

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
        "You organize browser tabs into groups.",
        "Output ONLY a JSON array. Each element: groupName (1-3 words), tabIndices (array of 1-based tab numbers), color (one of: grey, blue, red, yellow, green, pink, purple, cyan, orange).",
        "Tabs from the same domain usually belong in the same group.",
        "",
        "Example:",
        'Input: 1. [expedia.com] "Flights to Paris" 2. [allrecipes.com] "Best pasta recipe" 3. [booking.com] "Hotel deals Rome"',
        'Output: [{"groupName":"Travel","tabIndices":[1,3],"color":"cyan"},{"groupName":"Cooking","tabIndices":[2],"color":"orange"}]',
        "",
        "Rules: every tab in exactly one group, short names (1-3 words), JSON array only — no other text."
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
