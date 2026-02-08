# Privacy & Security

## Core Principle: Your Data Stays on Your Device

Auto Tab Groups is designed with privacy as a first-class priority. All AI features run **entirely on your device** using WebLLM and WebGPU. No tab data, URLs, or browsing history is ever sent to any server.

## Data Usage

### Without AI Features

- The extension only reads tab URLs and titles to determine grouping
- All data stays in `browser.storage.local` (never transmitted)
- No analytics, tracking, or telemetry

### With AI Features Enabled

- Tab titles and URLs are processed **locally** by an on-device AI model via [WebLLM](https://github.com/mlc-ai/web-llm)
- The AI model runs in your browser using WebGPU (your GPU)
- **No data is sent to any server** — all inference happens on-device
- Model weights are downloaded once from a CDN and cached in the browser
- AI suggestion cache is stored in `browser.storage.local` and auto-expires after 30 minutes

## User Control

- AI features are **opt-in** (disabled by default)
- Users choose which AI model to download and load
- Users explicitly trigger AI actions ("Suggest Groups", "Generate Rule")
- AI suggestions must be manually reviewed and applied — nothing happens automatically
- Models can be unloaded at any time to free GPU memory
- AI features can be disabled entirely with a single toggle

## Permissions

The extension requests only the minimum permissions needed:

- `tabs` — Read tab URLs and titles for grouping
- `tabGroups` — Create and manage tab groups
- `storage` — Persist settings and rules locally
- `sidePanel` — Chrome side panel support

No permissions are required for network access, history, bookmarks, or any other sensitive data.

## Future Considerations

- If external AI providers are added in the future, they will be opt-in with clear disclosure of what data is sent
- No user accounts or payment systems are currently planned
- Full privacy policy will be provided if the data model changes
