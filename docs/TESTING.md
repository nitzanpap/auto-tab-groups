# Testing Guide

## Running Tests

```bash
bun test           # Unit tests (Vitest)
bun run test:e2e   # E2E tests (Playwright)
```

## E2E Test Structure

```tree
tests/e2e/
├── extension.spec.ts       # UI tests
├── tab-grouping.spec.ts    # Domain grouping
├── auto-grouping.spec.ts   # Auto-group toggle
├── custom-rules.spec.ts    # Custom rules
├── group-operations.spec.ts # Collapse/expand
├── minimum-tabs.spec.ts    # Threshold tests (skipped)
└── helpers/
    └── extension-helpers.ts
```

## Test Suites

### Tab Grouping by Domain

- Groups tabs from same domain into one group
- Separates tabs from different domains
- Handles ccSLD correctly (bbc.co.uk -> "bbc")
- Does not group pinned tabs
- Handles subdomain mode

### Auto-Grouping Toggle

- Groups tabs automatically when enabled
- Does not group when disabled
- Manual group works when disabled
- Ungroup all removes all groups

### Test Suites - Custom Rules

- Rule groups matching tabs under rule name
- Rule takes priority over domain grouping
- Disabled rule does not apply
- Delete rule regroups tabs by domain

### Group Operations

- Collapse all groups
- Expand all groups
- Toggle collapse state

### Auto-Collapse / Focus Mode

- Collapses other groups when switching tabs
- Expands active tab's group if collapsed
- Handles ungrouped active tabs (collapses all)
- Skips already collapsed groups
- Exponential backoff retry on transient errors

## Manual Testing Checklist

### Basic Grouping

- [ ] New tab to `chatgpt.com` creates "ChatGPT" group
- [ ] New tab to `github.com` creates "GitHub" group
- [ ] Tab URL change moves tab to correct group
- [ ] Multiple same-domain tabs share one group

### Subdomain Mode

- [ ] Enabled: `mail.google.com` and `drive.google.com` create separate groups
- [ ] Disabled: Both grouped under "Google"

### Manual Testing - Custom Rules

- [ ] Rule domain groups under rule name (not domain)
- [ ] Rule color applied to group
- [ ] Edit rule updates existing groups
- [ ] Delete rule regroups by domain

### URL Patterns

- [ ] `docs.google.com/forms` matches `docs.google.com/forms/create`
- [ ] `google.**/forms` matches `google.com/forms` and `google.org/forms`
- [ ] `chrome.google.com/**/devconsole` matches variable paths

### Pinned Tabs

- [ ] Pinned tabs never grouped
- [ ] Unpinning triggers grouping
- [ ] URL change in pinned tab keeps it ungrouped

### Manual Testing - Auto-Grouping Toggle

- [ ] Disabled: new tabs ungrouped
- [ ] Re-enabled: new tabs grouped again
- [ ] Manual "Group Tabs" works when disabled

### Collapse/Expand

- [ ] "Collapse All" collapses all groups
- [ ] "Expand All" expands all groups
- [ ] Firefox: active tab's group stays expanded

### Focus Mode (Auto-Collapse)

- [ ] Enable Focus Mode in settings
- [ ] Switch tabs: other groups collapse, active group expands
- [ ] Switch to ungrouped tab: all groups collapse
- [ ] Manually expand a group: stays expanded until tab switch
- [ ] Rapid tab switching: groups collapse reliably (~95%)
- [ ] Disable Focus Mode: groups stay as-is when switching

### Edge Cases

- [ ] `about:blank`, `chrome://` URLs ignored
- [ ] Extension stable with 10+ rapid tab creations
- [ ] Multiple windows maintain separate groups

### Persistence

- [ ] Settings survive browser restart
- [ ] Groups restored after restart
- [ ] Colors persist across sessions

## Test Environment Setup

1. Install extension in dev mode
2. Open developer console (F12)
3. Clear existing tab groups
4. Reset settings to defaults

### AI Features

- [ ] Enable AI in popup -> AI Features section appears
- [ ] Select model -> model appears in dropdown
- [ ] Load model -> progress bar fills, status shows "Ready"
- [ ] "Suggest Groups" -> suggestions appear with group names and tab lists
- [ ] Apply a suggestion -> tab group created in browser
- [ ] Reopen popup after apply -> cached suggestions shown, applied one marked "Applied!"
- [ ] Apply remaining suggestions one by one
- [ ] "Dismiss" clears suggestions
- [ ] "Suggest Groups" again -> fresh suggestions replace old cache
- [ ] Unload model -> status returns to "Idle"
- [ ] Disable AI -> AI section hidden

### AI Edge Cases

- [ ] Suggest with 0 eligible tabs shows error
- [ ] Suggest with pinned-only tabs shows "No eligible tabs"
- [ ] Close tabs after suggest, apply -> stale tabs handled gracefully
- [ ] Service worker restart -> model unloaded, settings preserved
- [ ] No WebGPU -> warning shown, load button disabled

## Unit Test Suites

### AI Tests

Located in `tests/`:

- **`AiService.test.ts`** - Service orchestration, model lifecycle, settings persistence
- **`WebLlmProvider.test.ts`** - Model loading, completion, response_format passthrough
- **`AiResponseParser.test.ts`** - JSON extraction strategies, suggestion parsing, rule parsing, edge cases
- **`PromptTemplates.test.ts`** - Prompt structure, few-shot examples, tab formatting
- **`WebGpuUtils.test.ts`** - WebGPU capability detection

## Common Issues

- Tabs not grouped when expected
- Duplicate groups created
- Settings not persisting
- Console errors during operations
- AI model fails to load: check WebGPU availability and VRAM
- AI suggestions empty: check browser console for parse errors
