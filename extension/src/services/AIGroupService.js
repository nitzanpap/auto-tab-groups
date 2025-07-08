import { CreateMLCEngine } from "@mlc-ai/web-llm"

// Add this to the top:
const groupingSchema = {
  type: "object",
  properties: {
    groups: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          tabIds: {
            type: "array",
            items: { type: "integer" },
            minItems: 2
          },
          suggestedColor: { type: "string" },
          description: { type: "string" }
        },
        required: ["name", "tabIds"]
      }
    },
    reasoning: { type: "string" }
  },
  required: ["groups"]
}

const organizationInsightsSchema = {
  type: "object",
  properties: {
    insights: {
      type: "array",
      items: { type: "string" }
    },
    suggestions: {
      type: "array",
      items: { type: "string" }
    },
    productivity_score: {
      type: "integer",
      minimum: 0,
      maximum: 100
    }
  },
  required: ["insights", "suggestions", "productivity_score"]
}

class AIGroupService {
  constructor() {
    this.engine = null
    this.isInitialized = false
    this.isInitializing = false
    this.modelId = "Llama-3.2-1B-Instruct-q4f16_1-MLC" // Small model for browser
    this.initProgressCallback = null
  }

  /**
   * Initialize the WebLLM engine
   * @param {Function} progressCallback - Optional callback for initialization progress
   * @returns {Promise<boolean>} - Success status
   */
  async initialize(progressCallback = null) {
    if (this.isInitialized) return true
    if (this.isInitializing) {
      // Wait for ongoing initialization
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      return this.isInitialized
    }

    this.isInitializing = true
    this.initProgressCallback = progressCallback

    try {
      console.log("WebLLM AI initialization started...")

      // Initialize the real WebLLM engine with default configuration
      this.engine = await CreateMLCEngine(this.modelId, {
        initProgressCallback: progress => {
          console.log("WebLLM init progress:", progress)
          if (this.initProgressCallback) {
            this.initProgressCallback(progress)
          }
        }
      })

      this.isInitialized = true
      console.log("WebLLM engine initialized successfully")
      return true
    } catch (error) {
      console.error("Failed to initialize AI:", error)
      this.isInitialized = false
      return false
    } finally {
      this.isInitializing = false
    }
  }

  /**
   * Analyze tabs and suggest groupings using AI
   * @param {Array} tabs - Array of tab objects
   * @returns {Promise<Object>} - AI-suggested groupings
   */
  async analyzeTabs(tabs) {
    if (!this.isInitialized) {
      const success = await this.initialize()
      if (!success) {
        throw new Error("Failed to initialize AI engine")
      }
    }

    const groupableTabs = tabs.filter(tab => {
      try {
        const url = new URL(tab.url)
        return (
          !url.protocol.startsWith("chrome") &&
          !url.protocol.startsWith("moz-extension") &&
          !url.protocol.startsWith("edge") &&
          !url.hostname.includes("extension")
        )
      } catch {
        return false
      }
    })

    const tabInfo = groupableTabs.map(tab => ({
      id: tab.id,
      title: tab.title,
      url: tab.url,
      domain: new URL(tab.url).hostname
    }))

    const prompt = `Group these ${tabInfo.length} browser tabs into logical categories based on content or domain similarity. You must assign each tab ID to exactly one group. Provide a short group name and optional color. Group tabs meaningfully and avoid duplicates.`

    try {
      const response = await this.engine.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that organizes browser tabs. Only respond with valid JSON."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.4,
        max_tokens: 600,
        response_format: {
          type: "json_object",
          schema: groupingSchema
        }
      })

      const aiResponse = response.choices[0].message.content
      console.log("AI grouping response:", aiResponse)

      const suggestions = JSON.parse(aiResponse)
      return this.validateAndEnrichSuggestions(suggestions, groupableTabs)
    } catch (error) {
      console.error("Error analyzing tabs with AI:", error)
      throw error
    }
  }

  /**
   * Validate and enrich AI suggestions
   * @private
   */
  validateAndEnrichSuggestions(suggestions, tabs) {
    if (!suggestions.groups || !Array.isArray(suggestions.groups)) {
      throw new Error("Invalid AI response format")
    }

    const validTabIds = new Set(tabs.map(t => t.id))
    const usedTabIds = new Set()

    // Validate and clean up suggestions
    const validGroups = []

    suggestions.groups.forEach(group => {
      if (!group.name || !Array.isArray(group.tabIds)) {
        console.log(`[AI] Skipping invalid group: ${group.name}`)
        return
      }

      // Remove duplicate tab IDs and filter valid ones that haven't been used yet
      const uniqueTabIds = [...new Set(group.tabIds)]
      const availableTabIds = uniqueTabIds.filter(id => validTabIds.has(id) && !usedTabIds.has(id))

      if (availableTabIds.length < 2) {
        console.log(
          `[AI] Skipping group "${group.name}": only ${availableTabIds.length} available tabs`
        )
        return
      }

      // Mark tab IDs as used
      availableTabIds.forEach(id => usedTabIds.add(id))

      // Parse color (take first valid color if multiple provided)
      let color = "blue"
      if (group.suggestedColor && typeof group.suggestedColor === "string") {
        const validColors = [
          "blue",
          "cyan",
          "green",
          "grey",
          "orange",
          "pink",
          "purple",
          "red",
          "yellow"
        ]
        const suggestedColors = group.suggestedColor.split("|").map(c => c.trim())
        color = validColors.find(c => suggestedColors.includes(c)) || "blue"
      }

      validGroups.push({
        name: group.name,
        description: group.description,
        tabIds: availableTabIds,
        suggestedColor: color
      })

      console.log(`[AI] Created group "${group.name}" with ${availableTabIds.length} tabs`)
    })

    // Create a "Miscellaneous" group for remaining ungrouped tabs
    const ungroupedTabs = tabs.filter(t => !usedTabIds.has(t.id))
    console.log(
      `[AI] ${ungroupedTabs.length} tabs remain ungrouped:`,
      ungroupedTabs.map(t => ({ id: t.id, title: t.title }))
    )

    if (ungroupedTabs.length >= 2) {
      validGroups.push({
        name: "Miscellaneous",
        description: "Other tabs that don't fit into specific categories",
        tabIds: ungroupedTabs.map(t => t.id),
        suggestedColor: "grey"
      })
      console.log(`[AI] Created Miscellaneous group with ${ungroupedTabs.length} tabs`)
    }

    console.log(
      `[AI] Final groups:`,
      validGroups.map(g => ({ name: g.name, count: g.tabIds.length, color: g.suggestedColor }))
    )

    return {
      groups: validGroups,
      reasoning: suggestions.reasoning || "AI-powered intelligent grouping",
      ungroupedTabs: ungroupedTabs.length >= 2 ? [] : ungroupedTabs
    }
  }

  /**
   * Generate custom rules from AI suggestions
   * @param {Object} suggestions - AI grouping suggestions
   * @returns {Array} - Custom rules that can be saved
   */
  generateRulesFromSuggestions(suggestions) {
    const rules = []

    suggestions.groups.forEach(group => {
      // Extract unique domains from the group's tabs
      const domains = new Set()
      group.tabIds.forEach(tabId => {
        const tab = this.findTabById(tabId)
        if (tab) {
          const domain = new URL(tab.url).hostname
          domains.add(domain)
        }
      })

      if (domains.size > 0) {
        rules.push({
          id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          name: group.name,
          domains: Array.from(domains),
          color: group.suggestedColor || "blue",
          createdBy: "ai",
          description: group.description
        })
      }
    })

    return rules
  }

  /**
   * Learn from user's manual grouping actions
   * @param {Object} groupingAction - Information about user's grouping action
   */
  async learnFromUserAction(groupingAction) {
    if (!this.isInitialized) return

    // Store user actions for future model fine-tuning
    // This is a placeholder for future enhancement
    console.log("Learning from user action:", groupingAction)
  }

  /**
   * Get AI insights about current tab organization
   * @param {Array} tabs - Current tabs
   * @param {Array} groups - Current groups
   * @returns {Promise<Object>} - Insights and suggestions
   */
  async getOrganizationInsights(tabs, groups) {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const ungroupedTabs = tabs.filter(t => !t.groupId || t.groupId === -1)
    const prompt = `Analyze the current browser tab organization and provide helpful insights and improvement suggestions.
  
  - Total tabs: ${tabs.length}
  - Total groups: ${groups.length}
  - Ungrouped tabs: ${ungroupedTabs.length}
  
  Groups:
  ${JSON.stringify(
    groups.map(g => ({ title: g.title, tabCount: g.tabs?.length || 0 })),
    null,
    2
  )}
  
  Use the schema to structure your response.`

    try {
      const response = await this.engine.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a productivity expert analyzing browser tab organization."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 500,
        response_format: {
          type: "json_object",
          schema: organizationInsightsSchema
        }
      })

      const result = JSON.parse(response.choices[0].message.content)
      return result
    } catch (error) {
      console.error("Error getting organization insights:", error)
      return {
        insights: ["Unable to analyze organization at this time"],
        suggestions: [],
        productivity_score: 0
      }
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.engine) {
      // WebLLM doesn't have an explicit cleanup method, but we can reset our state
      this.engine = null
      this.isInitialized = false
    }
  }

  /**
   * Helper to find tab by ID (should be provided by caller)
   * @private
   */
  findTabById(tabId) {
    // This will be set by the caller
    return this._tabsCache?.find(t => t.id === tabId)
  }

  /**
   * Set tabs cache for internal use
   */
  setTabsCache(tabs) {
    this._tabsCache = tabs
  }
}

// Export singleton instance
export default new AIGroupService()
