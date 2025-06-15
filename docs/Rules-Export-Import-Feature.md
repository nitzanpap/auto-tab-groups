# Rules Export/Import Feature

## Overview

The Auto Tab Groups extension now supports exporting and importing custom rules as JSON files. This feature allows users to:

- **Backup** their custom rules
- **Share** rules with others
- **Migrate** rules between browsers or devices
- **Restore** rules after a fresh installation

## How to Use

### Exporting Rules

1. Open the Auto Tab Groups popup
2. Click on "🔧 Custom Rules" to expand the rules section
3. Click the "📤 Export" button
4. A JSON file will be automatically downloaded with the filename format: `auto-tab-groups-rules-YYYY-MM-DD.json`

**Note**: The export button is disabled when there are no rules to export.

### Importing Rules

1. Open the Auto Tab Groups popup
2. Click on "🔧 Custom Rules" to expand the rules section
3. Click the "📥 Import" button
4. Select a JSON file containing exported rules
5. Choose whether to:
   - **Replace all existing rules** (click OK)
   - **Merge with existing rules** (click Cancel)
6. Review the import results in the confirmation dialog

## Export File Format

The exported JSON file contains:

```json
{
  "version": "1.0",
  "exportDate": "2025-06-15T12:00:00.000Z",
  "rules": {
    "rule-id-1": {
      "id": "rule-id-1",
      "name": "Rule Name",
      "domains": ["example.com", "*.subdomain.com"],
      "color": "blue",
      "enabled": true,
      "priority": 1,
      "createdAt": "2025-06-15T12:00:00.000Z"
    }
  },
  "totalRules": 1
}
```

### Field Descriptions

- `version`: Export format version (currently "1.0")
- `exportDate`: When the export was created
- `rules`: Object containing all custom rules
- `totalRules`: Total number of rules in the export

### Rule Fields

- `id`: Unique identifier for the rule
- `name`: Display name for the rule (max 50 characters)
- `domains`: Array of domains (supports wildcards like *.example.com)
- `color`: Group color (blue, red, yellow, green, pink, purple, cyan, orange)
- `enabled`: Whether the rule is active
- `priority`: Rule priority (lower numbers = higher priority)
- `createdAt`: When the rule was created

## Import Behavior

### Validation

During import, each rule is validated to ensure:

- Valid rule name (1-50 characters)
- At least one domain
- Maximum 20 domains per rule
- Valid domain format (supports wildcards)
- Valid color value

### Merge vs Replace

- **Replace Mode**: All existing rules are deleted before importing
- **Merge Mode**: New rules are added alongside existing ones
  - If a rule with the same ID exists, a new ID is generated
  - No existing rules are modified or deleted

### Error Handling

- Invalid rules are skipped with detailed error messages
- The import continues even if some rules fail validation
- A summary shows how many rules were imported, skipped, and any errors

## Sample Import File

A sample import file (`sample-rules-import.json`) is included with common rule examples:

- Communication Tools (Slack, Teams, Discord, Zoom)
- Google Workspace (Gmail, Drive, Docs, Sheets, Calendar)
- Development (GitHub, Stack Overflow, Atlassian)
- Social Media (Facebook, Twitter, Instagram, LinkedIn, Reddit)
- News & Information (Google News, Reuters, BBC, CNN, NPR)

## Technical Details

### Security

- Only JSON files are accepted for import
- All imported data is validated before saving
- No executable code is processed

### Storage

- Rules are stored in browser local storage
- Export/import operations preserve all rule metadata
- Auto-grouping is automatically triggered after successful import

### Compatibility

- Works with both Chrome and Firefox versions
- Export format is designed to be forward-compatible
- Future versions will support importing older export formats

## Troubleshooting

### Export Issues

- **Export button disabled**: No rules exist to export
- **Download fails**: Check browser download permissions

### Import Issues

- **"Invalid import file"**: Ensure the file is valid JSON with required fields
- **"No valid rules found"**: All rules failed validation - check rule format
- **Rules not appearing**: Check if auto-grouping is enabled and trigger manual grouping

### Common Validation Errors

- **"Rule name is required"**: Empty or missing rule name
- **"At least one domain is required"**: No domains specified
- **"Invalid domain format"**: Domain doesn't match expected pattern
- **"Maximum 20 domains per rule"**: Too many domains in a single rule

## Future Enhancements

Planned improvements for future versions:

- Export/import via cloud sync
- Rule templates and sharing marketplace
- Bulk rule editing capabilities
- Import from other tab management extensions
