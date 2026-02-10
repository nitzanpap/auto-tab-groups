# Features

## Pinned Tabs

Pinned tabs are never moved to groups and remain at the beginning of the tab bar.

### Behavior of Pinned Tabs

- **Pinned tab created**: Stays ungrouped
- **Existing tab pinned**: Removed from group, moves to tab bar start
- **Pinned tab unpinned**: Automatically grouped based on URL
- **Pinned tab URL changed**: Stays pinned and ungrouped

### Implementation

```javascript
// In handleTabUpdate
if (tab.pinned) {
  return false // Skip grouping
}

// In background.js - detect unpinning
if (changeInfo.pinned === false) {
  await tabGroupService.handleTabUpdate(tabId)
}
```

## URL Patterns

Custom rules support advanced URL pattern matching beyond simple domains.

### Pattern Types

| Pattern | Example | Matches |
| ------- | ------- | ------- |
| Domain Only | `google.com` | `google.com/*` |
| Subdomain Wildcard | `*.google.com` | `docs.google.com/*` |
| Domain + Path | `docs.google.com/forms` | `docs.google.com/forms*` |
| TLD Wildcard | `google.**/forms` | `google.com/forms`, `google.org/forms` |
| Path Wildcard | `site.com/**/admin` | `site.com/any/path/admin` |

### Examples

```txt
github.com/**/issues        -> github.com/owner/repo/issues
*.google.**/forms           -> docs.google.com/forms
console.cloud.google.com/** -> any path on console.cloud.google.com
```

### Limitations

- Single `**` per domain or path component
- Case-insensitive matching
- Protocol agnostic (works with http/https)

## Export/Import Rules

### Export

1. Open popup -> Custom Rules -> Export
2. Downloads `auto-tab-groups-rules-YYYY-MM-DD.json`

### Import

1. Open popup -> Custom Rules -> Import
2. Select JSON file
3. Choose Replace (all existing rules deleted) or Merge (add alongside existing)

### File Format

```json
{
  "version": "1.0",
  "exportDate": "2025-06-15T12:00:00.000Z",
  "rules": {
    "rule-id": {
      "id": "rule-id",
      "name": "Rule Name",
      "domains": ["example.com", "*.subdomain.com"],
      "color": "blue",
      "enabled": true,
      "minimumTabs": 1
    }
  },
  "totalRules": 1
}
```

### Validation

- Rule name: 1-50 characters
- At least one domain, max 20 per rule
- Valid domain format (supports wildcards)
- Valid color value

## Colors & UI

### Persistent Color Mapping

Group colors are saved persistently and restored after browser restarts.

- Colors saved when groups created or randomized
- Custom rule colors protected during "Generate New Colors"
- Automatic restoration on extension startup

### Collapse/Expand

Two stateless buttons for predictable behavior:

- **Collapse All**: Collapses all groups
- **Expand All**: Expands all groups
- **Firefox**: Respects active tab constraint (active tab's group stays expanded)

## Minimum Tabs Threshold

Groups only created when minimum tab count is met.

### Configuration

- **Global Setting**: Default minimum for all domains
- **Per-Rule Setting**: Override global for specific rules

### Behavior of Threshold

- Below threshold: tabs remain ungrouped
- Meets threshold: group created with all matching tabs
- Falls below threshold: group disbanded, tabs ungrouped

## Focus Mode (Auto-Collapse)

Focus Mode automatically collapses inactive tab groups when switching tabs, keeping only the active tab's group expanded.

### How It Works

1. **Tab Switch Detection**: Listens to `tabs.onActivated` events
2. **Active Group Identification**: Queries browser for fresh active tab state
3. **Collapse Others**: Collapses all groups except the active tab's group
4. **Expand Active**: Expands the active group if it was collapsed

### Settings

- **Toggle**: Enable/disable via popup settings
- **Collapse Delay**: Configurable delay before collapsing (default: 300ms)

### Behavior

- Only triggers on actual tab switches (event-driven, not polling)
- Respects user intent: manually expanded groups won't auto-collapse until you switch tabs
- Active tab's group always stays expanded
- Ungrouped tabs: all groups collapse when switching to an ungrouped tab

### Reliability Mechanism

Chrome's tab API can throw "Tabs cannot be edited right now" during tab transitions. The feature uses **exponential backoff** to handle this:

| Attempt | Delay  | Cumulative |
| ------- | ------ | ---------- |
| 0       | 0ms    | 0ms        |
| 1       | 25ms   | 25ms       |
| 2       | 50ms   | 75ms       |
| 3       | 100ms  | 175ms      |
| 4       | 200ms  | 375ms      |
| 5       | 400ms  | 775ms      |

This provides ~95% reliability by extending the retry window to ~775ms while keeping fast success on quick machines.

## AI Features (On-Device via WebLLM)

All AI features run entirely on-device using [WebLLM](https://github.com/mlc-ai/web-llm) with WebGPU acceleration. No tab data leaves the browser.

### Architecture

- **AiService** (`services/ai/AiService.ts`): Orchestrator managing model lifecycle (load/unload), settings persistence, and provider delegation
- **WebLlmProvider** (`services/ai/WebLlmProvider.ts`): WebLLM backend using dynamic `import()` (never loaded until user triggers it)
- **AiResponseParser** (`utils/AiResponseParser.ts`): Robust JSON extraction with multiple fallback strategies
- **PromptTemplates** (`utils/PromptTemplates.ts`): Engineered prompts for suggestion and rule generation

### Available Models

| Model | Size | VRAM | Notes |
|-------|------|------|-------|
| Qwen2.5 3B (Recommended) | 1750 MB | 2505 MB | Best quality for tab grouping |
| Llama 3.2 3B | 1820 MB | 2264 MB | Good alternative |
| Phi-3.5 Mini 3.8B | 2150 MB | 3672 MB | Largest, most capable |

### Tab Group Suggestions

1. User clicks "Suggest Groups" in popup/sidebar
2. Background queries current window tabs (filters pinned, extension, and system URLs; caps at 50)
3. Prompt instructs model to group by **topic** (not domain) with descriptive category names
4. Model returns `{"groups": [{ groupName, tabIndices, color }]}` (JSON mode enforced)
5. Parser validates, maps indices to tab IDs, deduplicates, and normalizes colors
6. UI renders suggestion cards with "Apply" and "Create Rule" buttons

### Suggestion Caching

Suggestions persist in `browser.storage.local` so they survive popup reopens:

- After `suggestGroups`: cache saved with `appliedIndices: []`
- After `applySuggestion`: the applied suggestion's index is added to `appliedIndices`
- On popup reopen: cached suggestions render with applied ones marked "Applied!" and disabled
- Cache expires after 30 minutes
- "Dismiss" button clears cache; clicking "Suggest Groups" overwrites with fresh results

### AI Rule Generation

1. User describes a rule in natural language (e.g., "Group social media sites")
2. Background sends description + existing domains to model
3. Model returns `{ name, domains[], color }`
4. Parser validates domains and color, returns structured rule for the rules modal

### Response Parsing Strategy

The AI response parser uses multiple extraction strategies for robustness:

1. Direct JSON parse (for clean `json_object` mode output)
2. `{"groups": [...]}` wrapper extraction
3. Markdown code fence extraction
4. Brace/bracket block extraction from surrounding text
5. JSONL (one object per line) concatenation

Each suggestion is individually validated:
- Group name truncated to 30 chars
- Tab indices validated against actual tab list
- Invalid colors normalized to `blue`
- Tabs deduplicated across groups (first-wins)

### Model State Management

- Model state is **ephemeral** (service workers restart); settings are persisted to storage
- UI polls `getAiModelStatus` every 500ms during loading to show progress
- Background fires-and-forgets `loadModel()` (never awaits it in message handler)
- WebGPU capability checked before enabling the load button
