# Wildcard Validation Fix

## Issue

The wildcard domain validation was failing with error "Invalid domain format: *.mozilla.org" even though the domain pattern was correct.

## Root Cause

The issue was in `src/utils/RulesUtils.js` in the `validateDomain()` function. This function was being called by `sanitizeDomains()` which is used when creating rules via `createSafeRule()`.

The original `validateDomain()` function only supported exact domain validation and didn't handle wildcard patterns starting with `*.`.

## Solution

Enhanced the `validateDomain()` function in `RulesUtils.js` to support wildcard patterns:

### Before (Broken)

```javascript
export function validateDomain(domain) {
  // ... basic checks ...
  
  // Only exact domain validation
  const domainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  if (!domainPattern.test(cleanDomain)) {
    return { isValid: false, error: "Invalid domain format" }
  }
  
  return { isValid: true }
}
```

### After (Fixed)

```javascript
export function validateDomain(domain) {
  // ... basic checks ...
  
  // Check for wildcard pattern (*.domain.com)
  if (cleanDomain.startsWith("*.")) {
    const baseDomain = cleanDomain.substring(2) // Remove "*."
    
    // Validate wildcard pattern
    if (!baseDomain || baseDomain.includes("*")) {
      return { isValid: false, error: "Invalid wildcard pattern. Use format: *.domain.com" }
    }
    
    // Validate the base domain part
    const domainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!domainPattern.test(baseDomain)) {
      return { isValid: false, error: "Invalid base domain in wildcard pattern" }
    }
    
    return { isValid: true }
  }

  // Regular domain validation (unchanged)
  const domainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  if (!domainPattern.test(cleanDomain)) {
    return { isValid: false, error: "Invalid domain format" }
  }
  
  return { isValid: true }
}
```

## Validation Logic

1. **Wildcard Detection**: If domain starts with `*.`, process as wildcard
2. **Base Domain Extraction**: Remove `*.` prefix to get base domain
3. **Wildcard Validation**: Ensure no additional wildcards in base domain
4. **Base Domain Validation**: Apply standard domain regex to base domain only
5. **Fallback**: Use exact domain validation for non-wildcard domains

## Test Cases

Added comprehensive test cases covering:

- Valid wildcard patterns: `*.mozilla.org`, `*.google.com`
- Valid exact domains: `github.com`, `api.github.com`
- Invalid wildcards: `*.com`, `*`, `*.*.domain.com`
- Invalid domains: empty strings, domains without TLD

## Files Modified

- `src/utils/RulesUtils.js` - Fixed `validateDomain()` function
- `wildcard-tests.js` - Added validation test cases
- `docs/Wildcard-Validation-Fix.md` - This documentation

## Result

Wildcard domains like `*.mozilla.org` now validate correctly and can be used in custom rules without errors.

## Impact

- ✅ **Fixes**: Wildcard domain validation
- ✅ **Maintains**: Backward compatibility with exact domains  
- ✅ **Preserves**: All existing functionality
- ✅ **Improves**: User experience with wildcard custom rules
