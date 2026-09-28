/**
 * Entity & Service Type Detector
 * Identifies major web platforms, services, and categories,
 * assigning appropriate branding group names and native Chrome tab group colors.
 */

import type { TabGroupColor } from "../types"

export interface DetectedEntity {
  name: string
  color: TabGroupColor
  category: string
}

interface ServiceDefinition {
  domains: string[]
  name: string
  color: TabGroupColor
  category: string
  pathPatterns?: Array<{ pattern: RegExp; name: string; color?: TabGroupColor }>
}

const KNOWN_SERVICES: ServiceDefinition[] = [
  {
    domains: ["google.com", "google.co", "google.org", "googleusercontent.com"],
    name: "Google",
    color: "blue",
    category: "Search & Productivity",
    pathPatterns: [
      { pattern: /mail\.google\.com|gmail\.com/, name: "Gmail", color: "red" },
      { pattern: /docs\.google\.com\/document/, name: "Google Docs", color: "blue" },
      { pattern: /docs\.google\.com\/spreadsheets/, name: "Google Sheets", color: "green" },
      { pattern: /docs\.google\.com\/presentation/, name: "Google Slides", color: "yellow" },
      { pattern: /drive\.google\.com/, name: "Google Drive", color: "yellow" },
      { pattern: /meet\.google\.com/, name: "Google Meet", color: "green" },
      { pattern: /calendar\.google\.com/, name: "Google Calendar", color: "blue" }
    ]
  },
  {
    domains: ["youtube.com", "youtu.be"],
    name: "YouTube",
    color: "red",
    category: "Video & Media"
  },
  {
    domains: ["github.com", "github.io", "githubusercontent.com"],
    name: "GitHub",
    color: "purple",
    category: "Development"
  },
  {
    domains: ["gitlab.com"],
    name: "GitLab",
    color: "orange",
    category: "Development"
  },
  {
    domains: ["stackoverflow.com", "stackexchange.com", "superuser.com", "serverfault.com"],
    name: "Stack Overflow",
    color: "orange",
    category: "Development"
  },
  {
    domains: ["reddit.com", "redd.it"],
    name: "Reddit",
    color: "orange",
    category: "Community & Social"
  },
  {
    domains: ["twitter.com", "x.com"],
    name: "X / Twitter",
    color: "cyan",
    category: "Community & Social"
  },
  {
    domains: ["facebook.com", "fb.com", "messenger.com"],
    name: "Facebook",
    color: "blue",
    category: "Community & Social"
  },
  {
    domains: ["instagram.com"],
    name: "Instagram",
    color: "pink",
    category: "Community & Social"
  },
  {
    domains: ["linkedin.com"],
    name: "LinkedIn",
    color: "blue",
    category: "Professional & Careers"
  },
  {
    domains: ["amazon.com", "amazon.co.uk", "amazon.de", "amazon.ca", "amazon.co.jp"],
    name: "Amazon",
    color: "yellow",
    category: "Shopping & Commerce"
  },
  {
    domains: ["aws.amazon.com", "console.aws.amazon.com"],
    name: "AWS",
    color: "orange",
    category: "Cloud Infrastructure"
  },
  {
    domains: ["microsoft.com", "live.com", "office.com", "sharepoint.com", "azure.com"],
    name: "Microsoft",
    color: "blue",
    category: "Productivity & Cloud"
  },
  {
    domains: ["netflix.com"],
    name: "Netflix",
    color: "red",
    category: "Video & Media"
  },
  {
    domains: ["spotify.com"],
    name: "Spotify",
    color: "green",
    category: "Music & Audio"
  },
  {
    domains: ["wikipedia.org", "wikimedia.org"],
    name: "Wikipedia",
    color: "grey",
    category: "Reference & Knowledge"
  },
  {
    domains: ["openai.com", "chatgpt.com"],
    name: "ChatGPT",
    color: "green",
    category: "AI & Tools"
  },
  {
    domains: ["anthropic.com", "claude.ai"],
    name: "Claude AI",
    color: "purple",
    category: "AI & Tools"
  },
  {
    domains: ["notion.so", "notion.site"],
    name: "Notion",
    color: "grey",
    category: "Productivity & Notes"
  },
  {
    domains: ["figma.com"],
    name: "Figma",
    color: "purple",
    category: "Design & Creative"
  },
  {
    domains: ["slack.com"],
    name: "Slack",
    color: "purple",
    category: "Communication"
  },
  {
    domains: ["discord.com", "discord.gg"],
    name: "Discord",
    color: "purple",
    category: "Communication"
  }
]

/**
 * Detect entity or service from tab URL and title
 */
export function detectEntityAndColor(url: string, title?: string): DetectedEntity | null {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()
    const fullUrl = parsed.href.toLowerCase()

    for (const service of KNOWN_SERVICES) {
      const matchesDomain = service.domains.some(
        d => hostname === d || hostname.endsWith(`.${d}`)
      )

      if (matchesDomain) {
        if (service.pathPatterns) {
          for (const pattern of service.pathPatterns) {
            if (pattern.pattern.test(fullUrl)) {
              return {
                name: pattern.name,
                color: pattern.color ?? service.color,
                category: service.category
              }
            }
          }
        }
        return {
          name: service.name,
          color: service.color,
          category: service.category
        }
      }
    }

    // Heuristics for developer docs, shopping, news
    if (hostname.includes("docs.") || hostname.includes("developer.") || (title && /documentation|manual|api reference/i.test(title))) {
      return {
        name: "Docs",
        color: "cyan",
        category: "Development"
      }
    }
    if (hostname.includes("shop") || hostname.includes("store") || (title && /cart|checkout|buy/i.test(title))) {
      return {
        name: "Shopping",
        color: "yellow",
        category: "Shopping & Commerce"
      }
    }
  } catch {
    // Ignore invalid URLs
  }

  return null
}
