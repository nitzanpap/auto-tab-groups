# Roadmap

## Completed

- [x] Domain-based auto tab grouping
- [x] URL pattern enhancement (domain+path, TLD wildcards, path wildcards)
- [x] Custom rules with colors and minimum tabs
- [x] Export/import rules
- [x] Pinned tab handling

## Planned

### AI-Driven Grouping

Server-side AI grouping using tab metadata.

**API Endpoint**: `POST /api/group-tabs-ai`

```json
// Request
{
  "tabs": [{ "id": 1, "title": "Example", "url": "https://example.com" }],
  "user_id": "optional",
  "token": "optional"
}

// Response
{
  "groups": [{ "group_name": "Work", "tab_ids": [1, 3, 5] }],
  "usage": { "tokens_used": 1, "tokens_remaining": 9 }
}
```

**Implementation Steps**:
1. Create `/api/group-tabs-ai` endpoint
2. Integrate AI provider (e.g., OpenAI)
3. Track token usage per user
4. Enforce quotas

### Premium Model

**Free Tier**:
- Automatic domain grouping
- 10 free AI grouping tokens

**Premium Tier**:
- Unlimited AI grouping
- Priority support
- Future advanced features

**Token System**:
- Each AI request = 1 token
- Free users: limited tokens to try
- Premium users: unlimited (or high quota)

### Future Features

- [ ] Token system and usage tracking
- [ ] Payment and account system
- [ ] Cloud sync for rules
- [ ] Rule templates marketplace
- [ ] Query parameter matching
- [ ] Pattern testing interface
