# Wildcard Support in Custom Rules

## Overview

The Auto Tab Groups extension now supports wildcard patterns in custom rules, making it much easier to group tabs from multiple subdomains under a single rule.

## Wildcard Syntax

### Basic Wildcard Pattern

Use `*.domain.com` to match any subdomain of `domain.com`

**Example:**

```md
Rule Domain: *.mozilla.org
Matches:
  ✅ developer.mozilla.org
  ✅ addons.mozilla.org  
  ✅ mozilla.org (base domain)
  ✅ support.mozilla.org
  ❌ badmozilla.org (not a subdomain)
```

## Usage Examples

### Before (without wildcards)

To group all Google services, you would need:

```md
domains:
  - mail.google.com
  - drive.google.com
  - docs.google.com
  - sheets.google.com
  - calendar.google.com
  - meet.google.com
  - photos.google.com
  - translate.google.com
  ... (many more)
```

### After (with wildcards)

Simply use:

```md
domains:
  - *.google.com
```

## Implementation Details

### Matching Logic

1. **Wildcard Pattern**: If rule domain starts with `*.`, extract base domain and check:
   - Exact match with base domain: `mozilla.org` matches `*.mozilla.org`
   - Subdomain match: Domain must end with `.basedomain` to ensure proper subdomain

2. **Exact Match**: Traditional exact domain matching for backward compatibility

### Validation Rules

- Wildcard must be in format `*.domain.com`
- Base domain must contain at least one dot
- No multiple wildcards or complex patterns allowed
- Invalid patterns: `*`, `*.com`, `domain.*`, `sub.*.domain.com`

### Security Considerations

- Only simple subdomain wildcards are supported
- No arbitrary regex patterns to prevent security issues
- Input validation ensures safe wildcard patterns

## User Interface Updates

### Rules Modal

- Updated placeholder text shows wildcard example
- Help text explains wildcard support
- Validation provides clear error messages for invalid patterns

### Example Rule Creation

**Rule Name:** "Mozilla Services"
**Domains:**

```md
*.mozilla.org
```

This single rule will group tabs from:

- developer.mozilla.org
- addons.mozilla.org
- support.mozilla.org
- any other Mozilla subdomain

## Backward Compatibility

- Existing rules with exact domain matches continue to work unchanged
- No migration needed for existing users
- Both wildcard and exact patterns can be mixed in the same rule

## Benefits

### For Users

- **Simplified Rule Creation**: One wildcard rule instead of many exact domains
- **Dynamic Coverage**: Automatically includes new subdomains
- **Easier Maintenance**: Fewer rules to manage
- **Familiar Syntax**: Standard wildcard pattern users expect

### For Developers

- **Cleaner Code**: More efficient domain matching
- **Better Performance**: Fewer rule entries to process
- **Enhanced Flexibility**: Supports complex domain hierarchies

## Testing

Comprehensive test cases validate:

- Subdomain matching with wildcards
- Base domain matching with wildcards
- Exact domain matching (backward compatibility)
- Case insensitive matching
- Invalid pattern rejection
- Edge case handling

## Future Enhancements

Potential future wildcard features:

- Port wildcards: `domain.com:*`
- Path wildcards: `domain.com/path/*`
- Multiple wildcard levels: `*.*.domain.com`

*Note: Current implementation focuses on subdomain wildcards for security and simplicity.*
