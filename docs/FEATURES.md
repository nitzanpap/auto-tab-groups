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
