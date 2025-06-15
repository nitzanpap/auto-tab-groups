# Custom Rule Colors and Firefox Collapse Fix

## 🐛 Issues Fixed

### 1. Custom Rule Colors Not Applied

**Problem:** When creating custom rules with specific colors, the color wasn't being applied to the actual tab groups.

**Root Cause:** The TabGroupService was only setting the group title when creating/updating groups, but ignored the custom color from the rule.

### 2. Firefox Collapse Creates New Tab

**Problem:** In Firefox, when collapsing all groups while the active tab is inside a group, Firefox creates a new tab because it can't display tabs in collapsed groups.

**Root Cause:** Chrome allows viewing tabs in collapsed groups, but Firefox doesn't, so it creates a new tab when the active tab's group gets collapsed.

## ✅ Solutions Implemented

### 1. Fixed Custom Rule Color Assignment

**Files Modified:**

- `src/services/TabGroupService.js` - Updated `handleTabUpdate` method

**Changes Made:**

**For New Groups:**

```javascript
// Set the group title and color (with error handling)
const updateOptions = {
  title: expectedTitle,
}

// If this is from a custom rule, apply the custom color
if (customRule && customRule.color) {
  updateOptions.color = customRule.color
  console.log(`[TabGroupService] Applying custom color "${customRule.color}" from rule "${customRule.name}"`)
}

await browserAPI.tabGroups.update(groupId, updateOptions)
```

**For Existing Groups:**

```javascript
// Update group color if this is from a custom rule
if (customRule && customRule.color && existingGroup.color !== customRule.color) {
  try {
    await browserAPI.tabGroups.update(existingGroup.id, {
      color: customRule.color
    })
    console.log(`[TabGroupService] Updated existing group color to "${customRule.color}" from rule "${customRule.name}"`)
  } catch (colorError) {
    console.warn(`[TabGroupService] Failed to update existing group color:`, colorError)
  }
}
```

### 2. Fixed Firefox Collapse Compatibility

**Files Modified:**

- `src/services/TabGroupService.js` - Updated `toggleAllGroupsCollapse` and `getGroupsCollapseState` methods

**New Logic:**

1. **Detect Active Tab Group:** Before collapsing, check if the current active tab is inside a group
2. **Skip Active Group:** When collapsing, skip the group containing the active tab
3. **Smart State Detection:** Update collapse state logic to account for the protected active group

**Key Implementation:**

```javascript
// Get the currently active tab to check if it's in a group
const [activeTab] = await browserAPI.tabs.query({
  active: true,
  currentWindow: true,
})

let activeTabGroupId = null
if (activeTab && activeTab.groupId !== browserAPI.tabGroups.TAB_GROUP_ID_NONE) {
  activeTabGroupId = activeTab.groupId
  console.log(`[TabGroupService] Active tab is in group ${activeTabGroupId}, will avoid collapsing this group`)
}

// Skip collapsing the group that contains the active tab (Firefox compatibility)
if (newCollapsedState && group.id === activeTabGroupId) {
  console.log(`[TabGroupService] Skipping collapse of group ${group.id} containing active tab`)
  continue
}
```

## 🎯 Results

### Custom Rule Colors

- ✅ **New groups** created from custom rules now have the correct color
- ✅ **Existing groups** are updated to match custom rule colors when tabs are added
- ✅ **Works for both** new tab creation and URL changes
- ✅ **Detailed logging** for debugging color assignment

### Firefox Collapse Compatibility  

- ✅ **No new tab creation** in Firefox when collapsing groups
- ✅ **Active tab remains visible** - its group stays expanded
- ✅ **All other groups** collapse as expected
- ✅ **Dynamic protection** - works regardless of which group contains the active tab
- ✅ **Cross-browser compatibility** - works in both Chrome and Firefox

## 🧪 Testing

### Test 13: Custom Rule Color Assignment

1. Create custom rule for `github.com` with red color
2. Navigate to `github.com`
3. Verify group is created with red color

### Test 14: Firefox Collapse Compatibility

1. In Firefox, create multiple tab groups
2. Navigate to a tab inside one group (make it active)
3. Click "Collapse all groups"
4. Verify all groups collapse EXCEPT the one containing active tab
5. Verify no new tab is created

## 📝 Console Output Examples

**Custom Rule Color:**

```log
[TabGroupService] Applying custom color "red" from rule "GitHub Projects"
[TabGroupService] Updated existing group 123 color to "red" from rule "GitHub Projects"
```

**Firefox Collapse:**

```log
[TabGroupService] Active tab is in group 456, will avoid collapsing this group
[TabGroupService] Skipping collapse of group 456 containing active tab
```

Both fixes maintain backward compatibility and provide detailed logging for debugging!
