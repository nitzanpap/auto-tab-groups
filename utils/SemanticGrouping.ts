/**
 * Semantic Grouping & Purpose Analysis Engine
 * Calculates similarity between pages, merges sites with similar purpose above
 * a configurable similarity threshold, extracts entities, and creates meaningful group names.
 */

import type { TabGroupColor } from "../types"
import { detectEntityAndColor } from "./EntityServiceDetector"

export interface TabAnalysisItem {
  id: number
  url: string
  title: string
  favIconUrl?: string
  domain: string
  tokens: Set<string>
  category?: string
  entityName?: string
  suggestedColor?: TabGroupColor
}

export interface SemanticGroupResult {
  groupName: string
  color: TabGroupColor
  tabIds: number[]
  dominantCategory?: string
  similarityScore: number
}

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can", "cannot", "could", "did", "do",
  "does", "doing", "don't", "down", "during", "each", "few", "for", "from", "further",
  "had", "has", "have", "having", "he", "her", "here", "hers", "herself", "him",
  "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself",
  "me", "more", "most", "my", "myself", "no", "nor", "not", "of", "off", "on",
  "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over",
  "own", "same", "she", "should", "so", "some", "such", "than", "that", "the",
  "their", "theirs", "them", "themselves", "then", "there", "these", "they", "this",
  "those", "through", "to", "too", "under", "until", "up", "very", "was", "we",
  "were", "what", "when", "where", "which", "while", "who", "whom", "why", "with",
  "would", "you", "your", "yours", "yourself", "yourselves", "home", "page", "index",
  "official", "site", "web", "online", "com", "org", "net"
])

const CATEGORY_COLORS: Record<string, TabGroupColor> = {
  "Development": "purple",
  "Search & Productivity": "blue",
  "Video & Media": "red",
  "Community & Social": "orange",
  "Shopping & Commerce": "yellow",
  "Cloud Infrastructure": "cyan",
  "Productivity & Notes": "green",
  "Music & Audio": "green",
  "Reference & Knowledge": "grey",
  "AI & Tools": "green",
  "Design & Creative": "purple",
  "Communication": "pink",
  "General": "blue"
}

/**
 * Tokenize title and URL path to extract semantic keywords
 */
export function extractPageTokens(url: string, title: string): Set<string> {
  const tokens = new Set<string>()

  try {
    const parsed = new URL(url)
    const hostParts = parsed.hostname.toLowerCase().split(".")
    for (const part of hostParts) {
      if (part.length > 2 && !STOP_WORDS.has(part)) {
        tokens.add(part)
      }
    }

    const pathWords = parsed.pathname.toLowerCase().split(/[/_\-+=&?#.]/)
    for (const word of pathWords) {
      if (word.length > 2 && !STOP_WORDS.has(word) && !/^\d+$/.test(word)) {
        tokens.add(word)
      }
    }
  } catch {
    // Keep raw string fallback
  }

  const titleWords = title.toLowerCase().split(/[\s,.:;!?'"()\[\]{}|\\/_\-]+/)
  for (const word of titleWords) {
    if (word.length > 2 && !STOP_WORDS.has(word) && !/^\d+$/.test(word)) {
      tokens.add(word)
    }
  }

  return tokens
}

/**
 * Compute semantic purpose similarity between two tabs (0.0 to 1.0)
 */
export function calculateTabSimilarity(a: TabAnalysisItem, b: TabAnalysisItem): number {
  if (a.id === b.id) return 1.0

  // Same domain base gives high baseline similarity
  const sameDomain = a.domain === b.domain
  let domainBonus = sameDomain ? 0.45 : 0.0

  // Same entity / brand gives strong bonus
  if (a.entityName && b.entityName && a.entityName === b.entityName) {
    domainBonus += 0.35
  } else if (a.category && b.category && a.category === b.category) {
    domainBonus += 0.25
  }

  // Jaccard similarity of keyword tokens
  const intersectionSize = Array.from(a.tokens).filter(t => b.tokens.has(t)).length
  const unionSize = new Set([...a.tokens, ...b.tokens]).size

  const jaccard = unionSize > 0 ? intersectionSize / unionSize : 0.0

  // Weighted combination
  const score = Math.min(1.0, domainBonus + jaccard * 0.55)
  return score
}

/**
 * Generate a meaningful, clean group name from a cluster of tabs
 */
export function generateMeaningfulGroupName(items: TabAnalysisItem[]): {
  name: string
  color: TabGroupColor
  category?: string
} {
  if (items.length === 0) {
    return { name: "New Group", color: "blue" }
  }

  // Count entities
  const entityCounts = new Map<string, number>()
  const categoryCounts = new Map<string, number>()
  const domainCounts = new Map<string, number>()
  const tokenFreq = new Map<string, number>()

  for (const item of items) {
    if (item.entityName) {
      entityCounts.set(item.entityName, (entityCounts.get(item.entityName) || 0) + 1)
    }
    if (item.category) {
      categoryCounts.set(item.category, (categoryCounts.get(item.category) || 0) + 1)
    }
    domainCounts.set(item.domain, (domainCounts.get(item.domain) || 0) + 1)

    for (const t of item.tokens) {
      tokenFreq.set(t, (tokenFreq.get(t) || 0) + 1)
    }
  }

  // Most prominent entity if covers >= 50%
  let topEntity: string | null = null
  let maxEntityCount = 0
  for (const [entity, count] of entityCounts.entries()) {
    if (count > maxEntityCount) {
      maxEntityCount = count
      topEntity = entity
    }
  }

  if (topEntity && maxEntityCount >= Math.ceil(items.length * 0.4)) {
    const firstItem = items.find(i => i.entityName === topEntity)
    return {
      name: topEntity,
      color: firstItem?.suggestedColor || "blue",
      category: firstItem?.category
    }
  }

  // Top category
  let topCategory: string | null = null
  let maxCategoryCount = 0
  for (const [cat, count] of categoryCounts.entries()) {
    if (count > maxCategoryCount) {
      maxCategoryCount = count
      topCategory = cat
    }
  }

  if (topCategory && maxCategoryCount >= Math.ceil(items.length * 0.4)) {
    return {
      name: topCategory,
      color: CATEGORY_COLORS[topCategory] || "blue",
      category: topCategory
    }
  }

  // Most frequent domain
  let topDomain = items[0].domain
  let maxDomainCount = 0
  for (const [d, count] of domainCounts.entries()) {
    if (count > maxDomainCount) {
      maxDomainCount = count
      topDomain = d
    }
  }

  // Check top tokens for descriptive label
  const sortedTokens = Array.from(tokenFreq.entries())
    .filter(([tok]) => tok !== topDomain && tok.length > 3)
    .sort((a, b) => b[1] - a[1])

  if (sortedTokens.length > 0 && sortedTokens[0][1] > 1) {
    const capitalized = sortedTokens[0][0].charAt(0).toUpperCase() + sortedTokens[0][0].slice(1)
    return {
      name: `${capitalized} Hub`,
      color: "purple"
    }
  }

  // Domain formatted
  const cleanDomain = topDomain
    .replace(/^www\./, "")
    .split(".")[0]
  const formatted = cleanDomain.charAt(0).toUpperCase() + cleanDomain.slice(1)

  return {
    name: formatted || "Tabs",
    color: "blue"
  }
}

/**
 * Cluster tabs into semantic groups based on similarity threshold
 */
export function clusterTabsBySemanticSimilarity(
  rawTabs: Array<{ id: number; url: string; title?: string; favIconUrl?: string }>,
  similarityThreshold = 0.6
): SemanticGroupResult[] {
  if (rawTabs.length === 0) return []

  // Pre-process tabs
  const items: TabAnalysisItem[] = rawTabs.map(t => {
    let domain = "unknown"
    try {
      domain = new URL(t.url).hostname
    } catch {
      // fallback
    }

    const title = t.title || domain
    const tokens = extractPageTokens(t.url, title)
    const entity = detectEntityAndColor(t.url, title)

    return {
      id: t.id,
      url: t.url,
      title,
      favIconUrl: t.favIconUrl,
      domain,
      tokens,
      category: entity?.category,
      entityName: entity?.name,
      suggestedColor: entity?.color
    }
  })

  // Agglomerative clustering with single-linkage or average-linkage
  const clusters: TabAnalysisItem[][] = items.map(item => [item])

  let merged = true
  while (merged) {
    merged = false
    let bestScore = -1
    let mergeIdxA = -1
    let mergeIdxB = -1

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        // Average similarity between all pairs in cluster i and cluster j
        let totalSim = 0
        let pairCount = 0

        for (const itemA of clusters[i]) {
          for (const itemB of clusters[j]) {
            totalSim += calculateTabSimilarity(itemA, itemB)
            pairCount++
          }
        }

        const avgSim = pairCount > 0 ? totalSim / pairCount : 0
        if (avgSim >= similarityThreshold && avgSim > bestScore) {
          bestScore = avgSim
          mergeIdxA = i
          mergeIdxB = j
          merged = true
        }
      }
    }

    if (merged && mergeIdxA >= 0 && mergeIdxB >= 0) {
      clusters[mergeIdxA] = clusters[mergeIdxA].concat(clusters[mergeIdxB])
      clusters.splice(mergeIdxB, 1)
    }
  }

  // Format results
  return clusters.map(cluster => {
    const { name, color, category } = generateMeaningfulGroupName(cluster)
    return {
      groupName: name,
      color,
      dominantCategory: category,
      tabIds: cluster.map(c => c.id),
      similarityScore: cluster.length > 1 ? similarityThreshold : 1.0
    }
  })
}
