# Minimum Tabs Feature Test Plan

## Overview

This test plan covers the minimum tabs threshold feature that allows users to set both global and per-rule minimum tab requirements before the extension creates tab groups.

## Test Environment Setup

- Global minimum tabs setting: 2
- Test with at least one rule having a custom minimum tabs value
- Clear all existing tabs/groups before each test for clean state

## Test Cases

### 1. Global Minimum Tabs Setting

#### 1.1 Basic Global Minimum

- **Setup**: Set global minimum to 2
- **Action**: Open single tab of domain without custom rule (e.g., github.com)
- **Expected**: No group created, tab remains ungrouped
- **Verify**: Console shows "Not enough tabs (1 < 2) to create group"

#### 1.2 Meeting Global Minimum

- **Setup**: Global minimum = 2
- **Action**: Open 2 tabs of same domain without custom rule
- **Expected**: Group created with both tabs
- **Verify**: Group title matches domain name

#### 1.3 Changing Global Minimum

- **Setup**: Start with global minimum = 3, have 2 tabs of same domain (ungrouped)
- **Action**: Change global minimum to 2
- **Expected**: Existing tabs automatically group together
- **Verify**: Re-evaluation happens after setting change

### 2. Rule-Specific Minimum Tabs

#### 2.1 Rule Minimum Lower Than Global

- **Setup**: Global = 2, Rule "Extensions" = 1
- **Action**: Open single tab matching Extensions rule (addons.mozilla.org)
- **Expected**: Group created immediately with 1 tab
- **Verify**: Console shows "Using rule-specific minimum: 1"

#### 2.2 Rule Minimum Higher Than Global

- **Setup**: Global = 1, Create rule "Social" with minimum = 3
- **Action**: Open 2 tabs of facebook.com
- **Expected**: No group created (needs 3)
- **Verify**: Console shows rule-specific minimum being used

#### 2.3 Rule Without Minimum Set

- **Setup**: Create new rule without setting minimum tabs field
- **Action**: Open tabs matching this rule
- **Expected**: Falls back to global minimum
- **Verify**: Console shows "Using global minimum"

### 3. UI Behavior

#### 3.1 Creating New Rule

- **Setup**: Create new rule
- **Action**: Leave minimum tabs field empty
- **Expected**: Field shows placeholder, help text shows current global setting
- **Verify**: Rule saved with `minimumTabs: null`

#### 3.2 Editing Existing Rule

- **Setup**: Edit rule with minimumTabs = 1
- **Action**: Open edit dialog
- **Expected**: Field shows "1"
- **Verify**: Value persists after save

#### 3.3 Clearing Rule Minimum

- **Setup**: Edit rule with minimumTabs = 3
- **Action**: Clear the field and save
- **Expected**: Rule reverts to using global minimum
- **Verify**: `minimumTabs: null` in saved data

### 4. Group Threshold Management

#### 4.1 Falling Below Threshold

- **Setup**: Group exists with 3 tabs, minimum = 3
- **Action**: Close 1 tab
- **Expected**: Group automatically disbanded, tabs ungrouped
- **Verify**: Console shows "Group no longer meets minimum threshold"

#### 4.2 Mixed Rules in Same Window

- **Setup**:
  - Rule A: minimum = 1
  - Rule B: minimum = 3
  - Global = 2
- **Action**: Open 1 tab each of rules A, B, and domain C
- **Expected**:
  - Rule A tab: grouped alone
  - Rule B tab: ungrouped
  - Domain C tab: ungrouped
- **Verify**: Each uses correct minimum

### 5. Edge Cases

#### 5.1 Zero Minimum

- **Setup**: Try to set minimum to 0
- **Action**: Enter 0 in minimum tabs field
- **Expected**: Treated as "no minimum" (groups with 1 tab)
- **Verify**: Behaves same as minimum = 1

#### 5.2 Invalid Values

- **Setup**: Try to enter non-numeric or negative values
- **Action**: Type "abc" or "-1" in field
- **Expected**: Field validation prevents invalid input
- **Verify**: HTML5 number input constraints work

#### 5.3 Maximum Value

- **Setup**: Set minimum to 10 (max allowed)
- **Action**: Open 9 tabs of same domain
- **Expected**: No group created
- **Verify**: Opens 10th tab creates group

### 6. Mode Interactions

#### 6.1 Domain vs Subdomain Mode

- **Setup**: Minimum = 2, mode = subdomain
- **Action**: Open mail.google.com and drive.google.com
- **Expected**: No group (different subdomains)
- **Verify**: Each subdomain evaluated separately

#### 6.2 Rules-Only Mode

- **Setup**: Mode = rules-only, domain without rule
- **Action**: Open tabs of non-rule domain
- **Expected**: No grouping regardless of tab count
- **Verify**: Only rule-matched domains group

### 7. Performance & State

#### 7.1 Extension Restart

- **Setup**: Configure minimums, create groups
- **Action**: Disable/enable extension
- **Expected**: All settings persist, groups maintain state
- **Verify**: Check storage contains minimumTabs values

#### 7.2 Browser Restart

- **Setup**: Configure various minimums
- **Action**: Restart browser completely
- **Expected**: All minimum settings restored
- **Verify**: First grouping uses correct minimums

### 8. Import/Export

#### 8.1 Export Rules

- **Setup**: Rules with various minimumTabs values
- **Action**: Export rules to JSON
- **Expected**: minimumTabs field included in export
- **Verify**: JSON contains correct values

#### 8.2 Import Rules

- **Setup**: Import rules with minimumTabs set
- **Action**: Import JSON file
- **Expected**: Minimum values properly imported
- **Verify**: Edit imported rules shows correct values

## Regression Tests

### Critical Paths to Verify

1. Basic auto-grouping still works when minimum = 1
2. Manual "Group Tabs" button ignores minimums
3. Ungroup All removes all groups regardless of minimums
4. Color management unaffected by minimum settings
5. Pinned tabs still excluded from counts

## Console Log Verification

Key log messages to verify feature is working:

```log
[TabGroupService] Rule "RuleName" minimumTabs field: X number
[TabGroupService] Using rule-specific minimum: X for rule "RuleName"
[TabGroupService] Using global minimum: X for rule "RuleName"
[TabGroupService] Tab count for "GroupName": X, minimum required: Y
[TabGroupService] Not enough tabs (X < Y) to create group
[TabGroupService] Group "Name" no longer meets minimum threshold, ungrouping all tabs
```

## Notes

- Test both in Chrome and Firefox for cross-browser compatibility
- Verify performance with many rules having different minimums
- Check memory usage doesn't increase significantly
- Ensure no console errors during any operations
