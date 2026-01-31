# Manual Tab Groups Protection

## Status: Deferred

This document describes an issue with how the extension handles user-created tab groups and a proposed solution. Implementation is deferred for future work.

## Problem Statement

The extension currently does NOT distinguish between groups it creates and groups created manually by the user. When auto-grouping is enabled:

1. Tabs in user-created groups get pulled out and regrouped by domain/rules
2. No tracking exists for which groups the extension created vs user-created
3. User's manual organization gets destroyed

### Example Scenario

1. User manually creates a group called "Shopping" with amazon.com and ebay.com tabs
2. Auto-grouping is enabled
3. User opens a new amazon.com tab
4. Extension sees the amazon.com tab and looks for an "amazon" group
5. Not finding one, it **ungroups** the tab from "Shopping" and creates a new "amazon" group
6. User's carefully organized "Shopping" group loses its amazon.com tab

## Current Code Behavior

In `services/TabGroupService.ts`:

```typescript
// Line 192-194: Only checks if tab is in the EXPECTED group
if (tab.groupId === existingGroup.id) {
  return true  // Skip - already in correct group
}

// Line 228-230: UNGROUPS tab from ANY other group
if (tab.groupId && tab.groupId !== -1) {
  await browser.tabs.ungroup([tabId])  // Destroys user's manual grouping
}
```

The extension uses **title-based matching** to find groups, not ownership tracking. This means it will move tabs from any group to achieve its expected grouping.

## Proposed Solution: Track Extension-Owned Groups

### Concept

- Store group IDs that the extension creates in `browser.storage.local`
- Before moving a tab, check if its current group is extension-owned
- Only move tabs from:
  - Extension-owned groups
  - Ungrouped tabs (no group)
- Never move tabs from user-created groups

### Key Design Decisions

#### 1. Storage Strategy

Use `browser.storage.local` (not in-memory) to survive service worker restarts:

```typescript
interface StorageSchema {
  ownedGroupIds: Record<number, number[]>  // windowId -> groupId[]
}
```

#### 2. Browser Restart Handling

Chrome may reassign group IDs after browser restart. The safest approach:

- Clear owned group IDs on browser startup
- After restart, treat ALL existing groups as user-created
- Extension rebuilds ownership list as it creates new groups

This is conservative - the extension never destroys groups it's unsure about.

#### 3. Title-Based Matching Still Works

The ownership tracking only affects "should I REMOVE this tab from its current group?"

- Finding groups by title: Still works (uses `findGroupByTitle()`)
- Adding tabs to existing groups: Still works
- Creating new groups: Still works

### Implementation Steps

1. **Add storage field** for `ownedGroupIds` in `types/storage.ts`
2. **Add tracking methods** in `TabGroupState.ts`:
   - `addOwnedGroup(windowId, groupId)`
   - `removeOwnedGroup(windowId, groupId)`
   - `isOwnedGroup(windowId, groupId)`
3. **Track on creation** in `TabGroupService.ts` when creating new groups
4. **Check before ungrouping** - only ungroup from owned groups
5. **Clean up on removal** - remove from tracking when groups are deleted

### Edge Cases

| Case | Behavior |
| ---- | -------- |
| Extension restart | Storage survives, group IDs unchanged |
| Browser restart | Clear owned IDs (IDs may have changed) |
| User renames extension group | Still owned (tracked by ID, not title) |
| User drags tab to manual group | Respect that, don't pull it out |
| User drags tab to extension group | Extension can still manage it |

### Alternative Approach: User Marks Protected Groups

Instead of automatic tracking, let users explicitly mark groups as "protected":

- Pros: User has explicit control
- Cons: Requires user action, extra UI complexity

This was not chosen because automatic tracking provides a better default experience.

## Verification Plan

1. Create manual group "My Stuff" with amazon.com tab
2. Enable auto-grouping
3. Open new amazon.com tab in a new window
4. New tab should create "amazon" group
5. Original tab in "My Stuff" should STAY there

## Files to Modify

- `types/storage.ts` - Add `ownedGroupIds` field
- `services/TabGroupState.ts` - Add ownership tracking methods
- `services/TabGroupService.ts` - Check ownership before ungrouping
- `entrypoints/background.ts` - Clean up on group removal

## Related User Feedback

> "a feature that allows you to right click on a group of tabs and make a custom rule using the domains of any websites inside of that tab group"

This feature request depends on proper handling of manual groups, as users would expect their manually created groups to be respected by the extension.
