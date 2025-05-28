# AI Grouping API

This document describes the API contract for the AI-driven tab grouping feature.

## Endpoint

`POST /api/group-tabs-ai`

## Request Body

```json
{
  "tabs": [
    {
      "id": 1,
      "title": "Example Tab",
      "url": "https://example.com"
    }
  ],
  "user_id": "optional-user-id-or-session",
  "token": "optional-auth-or-trial-token"
}
```

## Response

```json
{
  "groups": [
    {
      "group_name": "Work",
      "tab_ids": [1, 3, 5]
    }
  ],
  "usage": {
    "tokens_used": 1,
    "tokens_remaining": 9
  }
}
```

## Notes

- The server may enforce rate limits or token quotas.
- Tab data is only used for grouping and is not stored long-term.
- The extension should handle errors gracefully and inform the user if grouping fails.
