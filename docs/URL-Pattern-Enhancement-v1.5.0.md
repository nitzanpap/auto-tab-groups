# URL Pattern Enhancement v1.5.0

## Overview

This release significantly extends the URL specification capabilities of the Auto Tab Groups extension, evolving from simple domain matching to comprehensive URL pattern matching. The enhancement maintains full backward compatibility while adding powerful new pattern types.

## 🚀 **New Features**

### **1. Domain + Path Patterns**

Match specific pages within domains:

```
docs.google.com/forms
github.com/issues
stackoverflow.com/questions
```

### **2. TLD Wildcard Patterns**

Match across different top-level domains:

```
google.**/forms     → google.com/forms, google.org/forms
facebook.**/watch   → facebook.com/watch, facebook.co.uk/watch
```

### **3. Path Wildcard Patterns**

Match URLs with variable path segments:

```
chrome.google.com/**/devconsole     → chrome.google.com/u/0/devconsole
example.com/api/**/endpoint         → example.com/api/v1/endpoint
github.com/**/issues                → github.com/owner/repo/issues
```

### **4. Combined Patterns**

Mix multiple wildcard types:

```
*.google.**/forms                   → docs.google.com/forms
*.stackoverflow.com/questions/**    → meta.stackoverflow.com/questions/tagged/discussion
```

## 📋 **Pattern Syntax Reference**

| Pattern Type | Example | Matches | Description |
|--------------|---------|---------|-------------|
| **Domain Only** | `google.com` | `google.com/*` | Any page on domain (existing) |
| **Subdomain Wildcard** | `*.google.com` | `docs.google.com/*` | Any subdomain (existing) |
| **Domain + Path** | `docs.google.com/forms` | `docs.google.com/forms*` | Specific path prefix |
| **TLD Wildcard** | `google.**/forms` | `google.com/forms` | Cross-TLD matching |
| **Path Wildcard** | `site.com/**/admin` | `site.com/any/path/admin` | Variable path segments |
| **Combined** | `*.site.**/api/**` | `sub.site.com/api/anything` | Multiple wildcards |

## 🔧 **Technical Implementation**

### **Architecture Changes**

#### **RulesService Updates**

- **`findMatchingRule(url)`**: Now accepts full URLs instead of domains
- **`urlMatches()`**: New comprehensive URL pattern matching
- **`matchDomain()`**: Enhanced domain matching with TLD wildcards
- **`matchPath()`**: New path pattern matching with `**` wildcards
- **`validateRulePattern()`**: Comprehensive validation for all pattern types

#### **TabGroupService Updates**

- Updated to pass full URLs to RulesService
- Enhanced rules-only mode for URL pattern matching
- Improved error handling and logging

#### **UI Enhancements**

- Updated validation in rules modal
- Extended pattern format support
- Better error messages for invalid patterns

### **Pattern Matching Logic**

#### **URL Parsing**

```javascript
const url = new URL(tabUrl)
const domain = url.hostname.toLowerCase()
const path = url.pathname
```

#### **Domain Component Matching**

- **Exact**: `domain === pattern`
- **Subdomain**: `*.domain.com` matches subdomains and base domain
- **TLD Wildcard**: `domain.**` matches across TLDs

#### **Path Component Matching**

- **Prefix**: `path/prefix` matches paths starting with prefix
- **Wildcard**: `prefix/**/suffix` matches any segments between prefix and suffix

### **Validation Rules**

#### **Domain Patterns**

- Must contain at least one dot (e.g., `example.com`)
- TLD wildcards require prefix ending with dot (e.g., `google.`)
- Subdomain wildcards use standard `*.` format

#### **Path Patterns**

- Max 100 characters for path component
- `**` wildcard splits into exactly 2 parts
- No consecutive slashes or invalid characters
- Alphanumeric, hyphens, underscores, dots, and slashes allowed

## 🧪 **Testing Coverage**

### **Pattern Matching Tests**

- ✅ Basic domain matching (backward compatibility)
- ✅ Subdomain wildcard matching (existing functionality)
- ✅ Domain + path matching (new)
- ✅ TLD wildcard + path matching (new)
- ✅ Path wildcard matching (new)
- ✅ Combined pattern matching (new)
- ✅ Edge cases and error handling

### **Validation Tests**

- ✅ Valid pattern acceptance
- ✅ Invalid pattern rejection
- ✅ Comprehensive error messages
- ✅ UI validation synchronization

## 📈 **Performance Considerations**

### **Efficiency Improvements**

- **No Regex**: Custom string matching for better performance
- **Early Returns**: Fail-fast validation and matching
- **Minimal Overhead**: Backward compatible with existing domain matching

### **Memory Usage**

- **Stateless Operations**: No additional state storage required
- **Efficient Parsing**: URL parsing only when needed
- **Cached Validation**: Validation results cached during rule processing

## 🔄 **Backward Compatibility**

### **Existing Functionality Preserved**

- ✅ All existing domain patterns work unchanged
- ✅ `*.domain.com` subdomain wildcards function identically
- ✅ No migration required for existing users
- ✅ Mixed pattern types in same rule supported

### **API Compatibility**

- Method signatures updated but maintain functionality
- Internal URL handling transparent to users
- Storage format unchanged

## 🎯 **Use Cases**

### **Development Workflows**

```
# Group all GitHub issue pages
github.com/**/issues

# Group Google Cloud Console pages
console.cloud.google.com/**/compute
*.console.cloud.google.com/**/storage
```

### **Content Management**

```
# Group all WordPress admin pages
*.wordpress.com/wp-admin/**
*.wordpress.org/wp-admin/**

# Group documentation sites
docs.**.com/**
*.docs.**/api/**
```

### **Communication Platforms**

```
# Group video calls across platforms
meet.google.com/**
zoom.us/**/meeting
teams.microsoft.com/**/calls
```

## 🚦 **Migration Guide**

### **For Existing Users**

No action required - all existing rules continue to work exactly as before.

### **For New Advanced Patterns**

1. Open Rules Modal
2. Use new pattern syntax in domain field
3. Examples will show in placeholder text
4. Validation provides real-time feedback

### **Pattern Conversion Examples**

#### **Before (Multiple Rules)**

```
Rule 1: docs.google.com
Rule 2: sheets.google.com  
Rule 3: slides.google.com
```

#### **After (Single Rule)**

```
*.google.com/     # Covers all subdomains
OR
google.**/        # Covers all TLDs
```

## 🐛 **Known Limitations**

1. **Single `**` per component**: Only one `**` wildcard per domain or path
2. **Path wildcards**: No regex-style complex patterns
3. **Case sensitivity**: All matching is case-insensitive
4. **Protocol agnostic**: Patterns don't specify HTTP/HTTPS

## 🔮 **Future Enhancements**

### **Potential Additions**

- Query parameter matching: `site.com/search?q=**`
- Port-specific patterns: `localhost:3000/**`
- Negative patterns: `!internal.site.com/**`
- Pattern priorities and ordering

### **Advanced Features**

- Pattern testing interface
- Usage analytics for patterns
- Suggested patterns based on browsing

## 📊 **Version Information**

- **Version**: 1.5.0
- **Release Date**: December 2024
- **Compatibility**: Chrome 88+, Firefox 139+
- **Breaking Changes**: None (fully backward compatible)

## 📝 **Implementation Files Modified**

### **Core Services**

- `src/services/RulesService.js` - Enhanced URL pattern matching
- `src/services/TabGroupService.js` - Updated to use full URLs

### **UI Components**

- `src/public/rules-modal.js` - Extended validation and pattern support
- `src/public/rules-modal.html` - Updated placeholder examples

### **Utilities**

- Enhanced validation throughout the codebase
- Comprehensive error handling and logging

## 🎉 **Conclusion**

This enhancement represents a significant step forward in tab grouping flexibility while maintaining the simplicity and performance that users expect. The new URL pattern capabilities enable more precise and powerful grouping rules while preserving the ease of use that made the extension popular.

Users can now create sophisticated grouping rules that adapt to modern web application URL structures, providing better organization for complex workflows and multi-domain services.
