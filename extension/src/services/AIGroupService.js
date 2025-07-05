import { CreateMLCEngine } from "@mlc-ai/web-llm"
import browserAPI from "../utils/BrowserAPI.js"
import TabGroupState from "../state/TabGroupState.js"
import RulesService from "./RulesService.js"

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
      console.log("Initializing WebLLM engine...")

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
      console.error("Failed to initialize WebLLM:", error)
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

    // Prepare tab information for AI analysis
    const tabInfo = tabs.map(tab => ({
      id: tab.id,
      title: tab.title,
      url: tab.url,
      domain: new URL(tab.url).hostname
    }))

    const prompt = `You are a browser tab organization assistant. Analyze these open tabs and suggest logical groupings based on their content, purpose, or project. Consider the title, URL, and domain of each tab.

Tabs to analyze:
${JSON.stringify(tabInfo, null, 2)}

Provide grouping suggestions in this exact JSON format:
{
  "groups": [
    {
      "name": "Group Name",
      "description": "Brief description of why these tabs belong together",
      "tabIds": [list of tab IDs],
      "suggestedColor": "blue|red|yellow|green|pink|purple|cyan|orange"
    }
  ],
  "reasoning": "Brief explanation of the overall grouping strategy"
}

Focus on creating meaningful groups that help with productivity. Consider:
- Project-based grouping (tabs related to the same task/project)
- Content type (documentation, communication, entertainment)
- Workflow stages (research, development, testing)
- Time-based activities (morning routine, work tasks)

Only create groups with 2 or more tabs. Tabs can only belong to one group.`

    try {
      const response = await this.engine.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that organizes browser tabs. Always respond with valid JSON."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      })

      const aiResponse = response.choices[0].message.content
      console.log("AI grouping response:", aiResponse)

      // Parse and validate the response
      const suggestions = JSON.parse(aiResponse)
      return this.validateAndEnrichSuggestions(suggestions, tabs)
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
    const validGroups = suggestions.groups.filter(group => {
      if (!group.name || !Array.isArray(group.tabIds)) return false

      // Filter valid tab IDs that haven't been used yet
      group.tabIds = group.tabIds.filter(id => validTabIds.has(id) && !usedTabIds.has(id))

      // Mark tab IDs as used
      group.tabIds.forEach(id => usedTabIds.add(id))

      // Only keep groups with 2+ tabs
      return group.tabIds.length >= 2
    })

    return {
      groups: validGroups,
      reasoning: suggestions.reasoning || "AI-powered intelligent grouping",
      ungroupedTabs: tabs.filter(t => !usedTabIds.has(t.id))
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
          id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

    const prompt = `Analyze the current browser tab organization and provide insights.

Current setup:
- Total tabs: ${tabs.length}
- Total groups: ${groups.length}
- Ungrouped tabs: ${tabs.filter(t => !t.groupId || t.groupId === -1).length}

Groups:
${JSON.stringify(
  groups.map(g => ({ title: g.title, tabCount: g.tabs?.length || 0 })),
  null,
  2
)}

Provide insights in this JSON format:
{
  "insights": [
    "Key observation about the organization"
  ],
  "suggestions": [
    "Actionable suggestion for improvement"
  ],
  "productivity_score": 0-100
}`

    try {
      const response = await this.engine.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a productivity expert analyzing browser tab organization."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" }
      })

      return JSON.parse(response.choices[0].message.content)
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
