# Architecture

## Core Principle: Browser as Single Source of Truth (SSOT)

The extension uses a stateless architecture where the browser's tab groups API is authoritative. Service workers can restart at any time, so:

- Always query browser for current groups
- No cached domain mappings
- Simple title-based group matching
- Stateless operations

## Tab Grouping Flow

```txt
Tab URL changes -> Extract domain -> Determine expected title -> Find group by title -> Move if needed
```

### Steps

1. **Extract Domain**: Get domain from tab URL using `extractDomain()`
2. **Determine Expected Title**: Use `getDomainDisplayName()` or custom rule name
3. **Find Group by Title**: Query browser groups, match by exact title
4. **Move or Create**:
   - If group exists and tab not in it -> Move tab to existing group
   - If group doesn't exist -> Move tab to new group (browser creates automatically)
   - If tab already in correct group -> Do nothing

## No Empty Groups Allowed

Browsers do not allow empty tab groups. This means:

- You cannot create an empty group first, then add tabs
- Groups are created by moving tabs to them
- The browser automatically creates the group when the first tab is moved
- Groups are automatically deleted when the last tab is removed

### Creating Groups (Correct Approach)

```javascript
// Move tab to group (browser creates it automatically)
const groupId = await browser.tabs.group({
  tabIds: [tabId],
})

// Set the group title
await browser.tabGroups.update(groupId, {
  title: expectedTitle,
})
```

## API Methods

```javascript
// Move tab(s) to new or existing group
browser.tabs.group({
  tabIds: [tabId1, tabId2, ...],
  groupId?: existingGroupId  // Optional: specify existing group
})

// Update group properties
browser.tabGroups.update(groupId, {
  title: "Group Name",
  color: "blue"
})

// Query existing groups
browser.tabGroups.query({
  windowId: windowId
})
```

## Benefits

- **Reliability**: No state sync issues, no race conditions, browser is always authoritative
- **Simplicity**: ~150 lines vs ~1000+ lines, single service instead of many modules
- **Performance**: No complex state rebuilding, direct browser queries only when needed
- **Maintainability**: Stateless operations, clear linear logic flow
