# Domain Validation Separation

## Issue

There was potential confusion between general domain validation (which should reject wildcards) and custom rules domain validation (which should accept wildcards for UX purposes). The function names and purposes needed to be clearly separated.

## Solution

Separated domain validation into two distinct functions with clear purposes:

### 1. Strict Domain Validation (`DomainUtils.js`)

- **Function**: `validateStrictDomain(domain)`
- **Purpose**: Validates actual domains for URL processing
- **Behavior**: Rejects wildcards (`*`) as invalid
- **Use case**: When validating real domains from URLs or user input that should be valid domains

### 2. Rule Domain Validation (`RulesUtils.js`)  

- **Function**: `validateRuleDomain(domain)` (renamed from `validateDomain`)
- **Purpose**: Validates domains for custom rules
- **Behavior**: Accepts wildcards (`*.domain.com`) for pattern matching
- **Use case**: When validating user input for custom tab grouping rules

### 3. Frontend Rule Validation (`rules-modal.js`)

- **Function**: `isValidRuleDomainFormat(domain)` (renamed from `isValidDomainFormat`)
- **Purpose**: Frontend validation for rule creation UI
- **Behavior**: Matches backend rule validation logic

## Changes Made

### Backend (`RulesUtils.js`)

- Renamed `validateDomain()` to `validateRuleDomain()` for clarity
- Updated all internal calls to use the new function name
- Enhanced function documentation to specify it's for rules validation

### Frontend (`rules-modal.js`)

- Renamed `isValidDomainFormat()` to `isValidRuleDomainFormat()` for clarity
- Updated the call site to use the new function name
- Enhanced function documentation to specify it's for rules validation

### Utility (`DomainUtils.js`)

- Added new `validateStrictDomain()` function for general domain validation
- This function explicitly rejects wildcards
- Can be used when validating actual domains vs rule patterns

## Benefits

- **Clear separation of concerns**: Each validation function has a specific purpose
- **Prevents confusion**: Function names clearly indicate their intended use
- **Maintains functionality**: All existing wildcard support for rules is preserved
- **Future-proof**: If we need strict domain validation elsewhere, it's available

## Usage Examples

```javascript
// For validating actual domains (no wildcards)
import { validateStrictDomain } from './utils/DomainUtils.js'
const result = validateStrictDomain('github.com') // ✓ Valid
const result2 = validateStrictDomain('*.github.com') // ✗ Invalid (wildcard not allowed)

// For validating rule patterns (wildcards allowed)
import { validateRuleDomain } from './utils/RulesUtils.js'
const result3 = validateRuleDomain('github.com') // ✓ Valid
const result4 = validateRuleDomain('*.github.com') // ✓ Valid (wildcard allowed for rules)
```

This separation ensures that domain validation is used appropriately based on context, maintaining the intended UX for custom rules while preserving strict validation where needed.
