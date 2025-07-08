# URL Pattern Support in Custom Rules

## Overview

The Auto Tab Groups extension supports comprehensive URL pattern matching in custom rules, evolving from simple domain wildcards to powerful URL pattern specifications. This makes it much easier to group tabs from multiple subdomains, different TLDs, and specific page paths under a single rule.

## Pattern Types

### 1. Domain Patterns (Basic)

**Exact Domain Matching**

```md
google.com
```

Matches any page on the exact domain.

### 2. Subdomain Wildcards

**Basic Wildcard Pattern**
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

### 3. Domain + Path Patterns (NEW)

**Specific Page Matching**

```md
docs.google.com/forms
github.com/issues
stackoverflow.com/questions
```

Matches specific pages or path prefixes within domains.

### 4. TLD Wildcard Patterns (NEW)

**Cross-TLD Matching**
Use `domain.**/path` to match across different top-level domains:

**Example:**

```md
Rule Pattern: google.**/forms
Matches:
  ✅ google.com/forms
  ✅ google.org/forms
  ✅ google.co.uk/forms
  ❌ docs.google.com/forms (prefix doesn't match)
```

### 5. Path Wildcard Patterns (NEW)

**Variable Path Segments**
Use `domain.com/**/endpoint` to match URLs with variable path segments:

**Example:**

```md
Rule Pattern: chrome.google.com/**/devconsole
Matches:
  ✅ chrome.google.com/u/0/devconsole
  ✅ chrome.google.com/u/1/devconsole
  ✅ chrome.google.com/enterprise/admin/devconsole
  ✅ chrome.google.com/devconsole (direct match)
  ❌ chrome.google.com/something/else
```

### 6. Combined Patterns (NEW)

**Multiple Wildcards**
Mix subdomain, TLD, and path wildcards:

**Example:**

```md
Rule Pattern: *.google.**/forms
Matches:
  ✅ docs.google.com/forms
  ✅ drive.google.org/forms
  ✅ google.com/forms (base domain)
```

## Pattern Syntax Reference

| Pattern Type | Example | Matches | Description |
|--------------|---------|---------|-------------|
| **Domain Only** | `google.com` | `google.com/*` | Any page on domain |
| **Subdomain Wildcard** | `*.google.com` | `docs.google.com/*` | Any subdomain |
| **Domain + Path** | `docs.google.com/forms` | `docs.google.com/forms*` | Specific path prefix |
| **TLD Wildcard** | `google.**/forms` | `google.com/forms` | Cross-TLD matching |
| **Path Wildcard** | `site.com/**/admin` | `site.com/any/path/admin` | Variable path segments |
| **Combined** | `*.site.**/api/**` | `sub.site.com/api/anything` | Multiple wildcards |

## Usage Examples

### Before (without advanced patterns)

To group all Google services across different regions and specific pages, you would need:

```md
domains:
  - mail.google.com
  - drive.google.com
  - docs.google.com/forms
  - calendar.google.com
  - meet.google.com
  - photos.google.com
  - translate.google.com
  ... (many more)
```

### After (with advanced patterns)

Simply use:

```md
domains:
  - *.google.**/
```

Or for specific functionality:

```md
domains:
  - *.google.**/forms    # All Google Forms across regions
  - *.google.**/drive    # All Google Drive pages
  - meet.google.**/      # Google Meet across all TLDs
```

## Advanced Use Cases

### Development Workflows

**GitHub Repository Management**

```md
Rule Name: "GitHub Issues"
Patterns:
  - github.com/**/issues
  - *.github.com/**/issues
```

**Google Cloud Console**

```md
Rule Name: "Cloud Console"
Patterns:
  - console.cloud.google.com/**/compute
  - *.console.cloud.google.com/**/storage
  - console.cloud.google.**/
```

### Content Management

**WordPress Administration**

```md
Rule Name: "WordPress Admin"
Patterns:
  - *.wordpress.com/wp-admin/**
  - *.wordpress.org/wp-admin/**
  - **/wp-admin/**
```

### Communication Platforms

**Video Conferencing**

```md
Rule Name: "Video Calls"
Patterns:
  - meet.google.com/**
  - zoom.us/**/meeting
  - teams.microsoft.com/**/calls
```

## Implementation Details

### Matching Logic

1. **URL Parsing**: Full URL is parsed into domain and path components
2. **Domain Matching**:
   - Exact match: `domain === pattern`
   - Subdomain wildcard: `*.domain.com` matches subdomains and base domain
   - TLD wildcard: `domain.**` matches across different TLDs
3. **Path Matching**:
   - Prefix match: `path/prefix` matches paths starting with prefix
   - Wildcard match: `prefix/**/suffix` matches any segments between prefix and suffix

### Validation Rules

#### Domain Patterns

- Must contain at least one dot (e.g., `example.com`)
- TLD wildcards require prefix ending with dot (e.g., `google.`)
- Subdomain wildcards use standard `*.` format
- No multiple wildcards in domain component

#### Path Patterns

- Maximum 100 characters for path component
- `**` wildcard splits pattern into exactly 2 parts
- No consecutive slashes (`//`)
- Alphanumeric, hyphens, underscores, dots, and slashes allowed

### Security Considerations

- Only simple wildcard patterns are supported
- No arbitrary regex patterns to prevent security issues
- Input validation ensures safe wildcard patterns
- All matching is case-insensitive

## User Interface Updates

### Rules Modal

- Updated placeholder text shows new pattern examples
- Help text explains all pattern types
- Real-time validation provides clear error messages for invalid patterns
- Pattern examples demonstrate various use cases

### Example Rule Creation

**Rule Name:** "Google Productivity"
**Patterns:**

```md
*.google.**/docs
*.google.**/sheets
*.google.**/slides
*.google.**/forms
```

This rule will group tabs from:

- All Google Docs, Sheets, Slides, and Forms
- Across all Google TLDs (.com, .org, etc.)
- From any subdomain (docs, sheets, etc.)

## Backward Compatibility

- Existing rules with exact domain matches continue to work unchanged
- No migration needed for existing users
- Both simple and advanced patterns can be mixed in the same rule
- All existing wildcard functionality preserved

## Performance

### Efficiency Improvements

- **No Regex**: Custom string matching for better performance
- **Early Returns**: Fail-fast validation and matching
- **Minimal Overhead**: Backward compatible with existing domain matching

### Memory Usage

- **Stateless Operations**: No additional state storage required
- **Efficient Parsing**: URL parsing only when needed
- **Cached Validation**: Results cached during rule processing

## Benefits

### For Users

- **Powerful Pattern Matching**: Create sophisticated grouping rules
- **Reduced Rule Count**: One pattern instead of many exact matches
- **Dynamic Coverage**: Automatically includes new subdomains and TLDs
- **Intuitive Syntax**: Familiar wildcard patterns users expect
- **Cross-Platform**: Works with international domains and TLDs

### For Developers

- **Cleaner Code**: More efficient URL pattern matching
- **Better Performance**: Optimized string operations instead of regex
- **Enhanced Flexibility**: Supports complex URL hierarchies
- **Maintainable**: Clear separation of domain and path matching logic

## Testing

Comprehensive test coverage validates:

- Basic domain matching (backward compatibility)
- Subdomain wildcards (existing functionality)
- Domain + path matching (new)
- TLD wildcard + path matching (new)
- Path wildcard matching (new)
- Combined pattern matching (new)
- Edge cases and error handling
- Input validation and sanitization

## Future Enhancements

Potential future pattern features:

- Query parameter matching: `domain.com/search?q=**`
- Port-specific patterns: `localhost:3000/**`
- Negative patterns: `!internal.domain.com/**`
- Pattern priorities and ordering
- Advanced path matching with multiple wildcards

## Known Limitations

1. **Single `**` per component**: Only one `**` wildcard per domain or path component
2. **Path wildcards**: No regex-style complex patterns
3. **Case sensitivity**: All matching is case-insensitive
4. **Protocol agnostic**: Patterns don't specify HTTP/HTTPS

*Note: Current implementation focuses on practical URL patterns for security, performance, and simplicity.*
