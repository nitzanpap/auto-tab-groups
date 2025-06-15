# Auto Tab Groups - Testing Checklist

This document provides a comprehensive checklist for testing the Auto Tab Groups extension functionality. Use this as a guide to ensure all features work correctly across different scenarios.

## Basic Tab Grouping Tests

### Test 1: New Tab Creation

- [ ] Create a new tab and navigate to `chatgpt.com`
- [ ] Verify a new group is created with the title "ChatGPT"
- [ ] Create another tab to `github.com`
- [ ] Verify a new group is created with the title "GitHub"

### Test 2: Tab URL Updates

- [ ] Create a new tab and navigate to `chatgpt.com`
- [ ] Verify it's grouped under "ChatGPT"
- [ ] Update the URL to `github.com` in the same tab
- [ ] Verify the tab moves to the "GitHub" group
- [ ] Update the URL back to `chatgpt.com`
- [ ] Verify the tab moves back to the "ChatGPT" group

### Test 3: Multiple Tabs Same Domain

- [ ] Create multiple tabs for the same domain (e.g., `github.com/user1`, `github.com/user2`)
- [ ] Verify all tabs are grouped under the same "GitHub" group
- [ ] Verify group title remains "GitHub" (not duplicated)

## Subdomain Grouping Tests

### Test 4: Subdomain Grouping Enabled

- [ ] Enable "Group by subdomain" in settings
- [ ] Navigate to `mail.google.com`
- [ ] Verify group is created with title "Mail Google"
- [ ] Navigate to `drive.google.com`
- [ ] Verify a separate group is created with title "Drive Google"
- [ ] Navigate to `docs.google.com`
- [ ] Verify a separate group is created with title "Docs Google"

### Test 5: Subdomain Grouping Disabled

- [ ] Disable "Group by subdomain" in settings
- [ ] Navigate to `mail.google.com`
- [ ] Navigate to `drive.google.com`
- [ ] Navigate to `docs.google.com`
- [ ] Verify all tabs are grouped under a single "Google" group

## Custom Rules Tests

### Test 6: Custom Rule Creation

- [ ] Create a custom rule: Domain `github.com` → Group Name `My Code`
- [ ] Navigate to `github.com`
- [ ] Verify tab is grouped under "My Code" instead of "GitHub"
- [ ] Navigate to `github.com/settings`
- [ ] Verify tab is also grouped under "My Code"

### Test 7: Custom Rule Priority

- [ ] Create a custom rule: Domain `docs.google.com` → Group Name `Documentation`
- [ ] Enable subdomain grouping
- [ ] Navigate to `docs.google.com`
- [ ] Verify tab is grouped under "Documentation" (custom rule takes priority)
- [ ] Navigate to `sheets.google.com`
- [ ] Verify tab is grouped under "Sheets Google" (no custom rule, uses subdomain)

### Test 8: Custom Rule Editing

- [ ] Edit an existing custom rule to change the group name
- [ ] Navigate to the domain covered by the rule
- [ ] Verify the tab uses the new group name
- [ ] Verify existing tabs in the old group are moved to the new group

## Auto-Grouping Toggle Tests

### Test 9: Disable Auto-Grouping

- [ ] Disable auto-grouping in settings
- [ ] Create new tabs to various domains
- [ ] Verify no new groups are created
- [ ] Verify tabs remain ungrouped

### Test 10: Re-enable Auto-Grouping

- [ ] Re-enable auto-grouping in settings
- [ ] Create new tabs to various domains
- [ ] Verify groups are created again
- [ ] Navigate to existing tabs (change URLs)
- [ ] Verify tab updates are processed

## "Only Apply to New Tabs" Tests

### Test 11: Only New Tabs Mode

- [ ] Enable "Only apply to new tabs" setting
- [ ] Create existing ungrouped tabs to various domains
- [ ] Verify existing tabs remain ungrouped
- [ ] Create new tabs to the same domains
- [ ] Verify only new tabs are grouped

### Test 12: Apply to All Tabs Mode

- [ ] Disable "Only apply to new tabs" setting
- [ ] Have existing ungrouped tabs to various domains
- [ ] Enable auto-grouping
- [ ] Verify existing tabs are automatically grouped
- [ ] Create new tabs
- [ ] Verify new tabs are also grouped

## Edge Cases and Error Handling

### Test 13: Invalid URLs

- [ ] Navigate to `about:blank`
- [ ] Navigate to `chrome://extensions`
- [ ] Navigate to `data:text/html,<h1>Test</h1>`
- [ ] Verify no groups are created for these URLs
- [ ] Verify no errors occur

### Test 14: Very Long Domain Names

- [ ] Navigate to a domain with a very long name
- [ ] Verify group is created with appropriate truncation if needed
- [ ] Verify extension remains functional

### Test 15: Special Characters in Domains

- [ ] Navigate to domains with special characters (if possible)
- [ ] Verify groups are created with sanitized names
- [ ] Verify extension remains functional

## Pinned Tab Handling Tests

### Test 16: Pinned Tab Creation

- [ ] Create a tab and navigate to `github.com`
- [ ] Pin the tab (right-click → Pin tab)
- [ ] Verify the pinned tab is NOT moved to any group
- [ ] Verify the pinned tab remains in its original position
- [ ] Check console logs for: "Tab X is pinned, skipping grouping"

### Test 17: Pinned Tab URL Update

- [ ] Create a tab, navigate to `github.com`, and pin it
- [ ] Update the URL to `chatgpt.com` in the pinned tab
- [ ] Verify the pinned tab is NOT moved to the ChatGPT group
- [ ] Verify the pinned tab remains pinned and in place
- [ ] Check console logs for: "Tab X is pinned, skipping grouping"

### Test 18: Unpin Previously Pinned Tab

- [ ] Have a pinned tab with URL `github.com`
- [ ] Unpin the tab (right-click → Unpin tab)
- [ ] Check console logs for: "Tab X was unpinned, applying grouping"
- [ ] Verify the tab is now moved to the appropriate GitHub group
- [ ] Create another tab to `github.com`
- [ ] Verify both tabs are in the same GitHub group

### Test 19: Mixed Pinned and Unpinned Tabs

- [ ] Create tabs for `github.com` - one pinned, one unpinned
- [ ] Verify only the unpinned tab is grouped
- [ ] Verify the pinned tab remains at the beginning of the tab bar
- [ ] Update the unpinned tab URL to `chatgpt.com`
- [ ] Verify it moves to the ChatGPT group while pinned tab stays put

## Performance and Stability Tests

### Test 20: Rapid Tab Creation

- [ ] Quickly create 10+ tabs to different domains
- [ ] Verify all tabs are grouped correctly
- [ ] Verify no duplicate groups are created
- [ ] Verify extension remains responsive

### Test 21: Rapid URL Changes

- [ ] In a single tab, rapidly change URLs between different domains
- [ ] Verify tab moves between groups correctly
- [ ] Verify no orphaned groups are left behind
- [ ] Verify extension remains stable

### Test 22: Multiple Windows

- [ ] Open multiple browser windows
- [ ] Create tabs in different windows for the same domains
- [ ] Verify groups are created per-window (not shared across windows)
- [ ] Verify each window maintains its own groups

## Browser Restart and Persistence Tests

### Test 23: Settings Persistence

- [ ] Configure custom rules and settings
- [ ] Restart the browser
- [ ] Verify all settings are preserved
- [ ] Verify custom rules still work

### Test 24: Group State After Restart

- [ ] Create several grouped tabs
- [ ] Restart the browser
- [ ] Verify groups are restored correctly
- [ ] Create new tabs to the same domains
- [ ] Verify new tabs join existing groups

## Cross-Browser Testing (Firefox)

### Test 25: Firefox Compatibility

- [ ] Install extension in Firefox
- [ ] Run basic grouping tests (Tests 1-3)
- [ ] Verify popup interface works correctly
- [ ] Verify settings are saved and loaded correctly

## Regression Testing

### Test 26: Core Functionality Regression

- [ ] Run Tests 1, 2, 6, 11, and 16 after any code changes
- [ ] Verify no existing functionality is broken
- [ ] Check console for new errors or warnings

## Notes for Testers

1. **Clear State Between Tests**: Clear extension storage between test runs to ensure clean state
2. **Console Monitoring**: Keep developer console open to monitor for errors
3. **Version Testing**: Test on both Chrome and Firefox when possible
4. **Real-World Usage**: Supplement structured tests with normal browsing patterns
5. **Performance Monitoring**: Watch for memory usage or performance degradation during testing

## Test Environment Setup

### Before Testing

1. Install the extension in development mode
2. Open developer console (F12)
3. Navigate to the extension's background page console
4. Clear any existing tab groups
5. Reset extension settings to defaults (if needed)

### After Testing

1. Document any bugs or unexpected behavior
2. Note browser version and OS
3. Save console logs if errors occurred
4. Clear test data for next testing session

## Common Issues to Watch For

- [ ] Tabs not being grouped when they should be
- [ ] Tabs being grouped when they shouldn't be (e.g., pinned tabs)
- [ ] Duplicate groups being created
- [ ] Groups not updating when rules change
- [ ] Settings not persisting after browser restart
- [ ] Performance issues with many tabs
- [ ] Console errors or warnings
- [ ] UI elements not responding in popup/settings
