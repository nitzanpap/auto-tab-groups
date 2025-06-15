# Current Tabs Filtering Fix

## Issue

The "Quick add from current tabs" feature in the rules modal was showing invalid domains in the suggestions list, including:

- Chrome extension internal pages (e.g., "fifnpnggkgolocphgcgipcdlcphmadmn")
- Browser internal URLs (chrome://, about:, moz-extension://, etc.)
- Invalid domains and localhost addresses

## Root Cause

The `loadCurrentTabs()` function in `rules-modal.js` was using manual URL filtering that:

- Only checked for a few specific protocols (`chrome://`, `moz-extension://`, `about:`)
- Missed `chrome-extension://` protocol
- Didn't use proper domain validation
- Manually parsed URLs instead of using existing utility functions

## Solution

Updated the current tabs filtering to use proper domain utilities and validation:

### 1. Added Domain Extraction Utility

- Copied `extractDomain()` function from `DomainUtils.js` to `rules-modal.js`
- This function properly handles all browser/extension protocols and returns "system" for invalid URLs

### 2. Added Strict Domain Validation

- Copied `validateStrictDomain()` logic to validate actual domains
- Rejects wildcards and invalid domain formats
- Ensures only valid, real domains appear in suggestions

### 3. Updated Filtering Logic

- Replaced manual URL parsing with `extractDomain()` utility
- Added validation with `isValidStrictDomain()`
- Filters out:
  - `null` domains (invalid URLs)
  - "system" domains (extension/browser URLs)
  - Invalid domain formats

## Changes Made

### `rules-modal.js`

- Added `extractDomain()` function (copied from DomainUtils.js)
- Added `isValidStrictDomain()` function for domain validation
- Updated `loadCurrentTabs()` to use proper filtering:

```javascript
// Before: Manual filtering
if (
  !tab.url ||
  tab.url.startsWith("chrome://") ||
  tab.url.startsWith("moz-extension://") ||
  tab.url.startsWith("about:")
) {
  return // Incomplete filtering
}

// After: Proper domain extraction and validation
const domain = extractDomain(tab.url)
if (!domain || domain === "system" || !isValidStrictDomain(domain)) {
  return // Complete filtering
}
```

## URLs Now Properly Filtered

### ✅ Excluded from suggestions

- `chrome-extension://fifnpnggkgolocphgcgipcdlcphmadmn/...` (extension pages)
- `chrome://extensions/` (browser settings)
- `moz-extension://...` (Firefox extension pages)
- `about:blank` (browser internal pages)
- `edge://settings/` (Edge browser pages)
- `file:///...` (local files)
- `https://localhost:3000` (development servers)
- Invalid URLs and malformed domains

### ✅ Included in suggestions

- `github.com`, `google.com`, `chatgpt.com` (valid websites)
- `teams.microsoft.com`, `slack.com` (valid subdomains)
- All properly formatted website domains

## Benefits

- **Clean suggestions**: Only valid website domains appear in the current tabs list
- **No extension clutter**: Extension internal pages are filtered out
- **Consistent validation**: Uses same domain logic as the rest of the extension
- **Cross-browser compatibility**: Handles Chrome, Firefox, and Edge protocols
- **Future-proof**: Any new browser protocols will be handled by the "system" classification

## Testing

- Verified that extension pages (like the rules modal itself) no longer appear in suggestions
- Confirmed that all browser internal URLs are filtered out
- Tested that valid website domains still appear correctly
- Built and tested for both Chrome and Firefox
