# AI Integration Plan for Auto Tab Groups

## Overview

This document outlines the strategy for integrating AI capabilities into Auto Tab Groups. The goal is to enhance the extension's core tab grouping functionality with intelligent features that genuinely add value — not AI for AI's sake.

## Guiding Principles

- **Privacy-first**: Client-side inference via WebLLM as the default; external API as opt-in
- **Manual invocation**: AI features are triggered by the user, not autonomous
- **Additive, not replacement**: AI enhances the existing domain/rules system; it doesn't replace it
- **Lightweight by default**: AI is opt-in; the extension works fully without it

## Features (Ranked by Impact)

### Feature 1: Smart Rule Generation from Natural Language (Highest Impact)

**Problem:** Creating custom rules requires understanding pattern syntax (wildcards, segment extraction, regex). This is a significant friction point for users.

**Solution:** Let users describe rules in plain English.

Examples:

- "Group all my AWS console tabs by service name" → Generates `{service}.console.aws.amazon.com` with segment extraction
- "Put all shopping sites together" → Generates rules for amazon.com, ebay.com, etsy.com, etc.
- "Group React and Vue documentation separately" → Generates two rules with appropriate patterns

**Integration point:** New "AI Assist" button in the rules modal that opens a natural language input. AI output maps directly to existing `CustomRule` objects.

### Feature 2: Intelligent Tab Grouping Suggestions (High Impact)

**Problem:** Users must manually discover grouping opportunities. The extension doesn't analyze open tabs for patterns.

**Solution:** Analyze currently open tabs (titles + URLs) and suggest meaningful groups.

Examples:

- "You have 6 tabs about TypeScript generics across 4 sites — create a 'TS Generics Research' group?"
- "These 3 tabs look like job applications — group as 'Job Search'?"

**Integration point:** New "Suggest Groups" button in the popup/sidebar. AI analyzes all open tabs and returns suggestions the user can accept/reject.

### Feature 3: Content-Aware Grouping Mode (High Impact, More Complex)

**Problem:** Current grouping is purely URL-based. Tabs about the same topic on different domains can't be grouped automatically.

**Solution:** A new grouping mode alongside domain/subdomain/rules-only:

- **AI mode**: Groups tabs by semantic similarity of their titles/URLs
- Example: An MDN page, a Stack Overflow question, and a blog post about CSS Grid → all grouped under "CSS Grid"

**Integration point:** New option in the group-by mode selector. Runs on-demand when user triggers re-grouping.

### Feature 4: "Why Is This Tab Here?" Explainer (Medium Impact, Easy)

**Problem:** When rules overlap or behavior is unexpected, users can't debug why a tab ended up in a specific group.

**Solution:** Right-click a tab → "Why is this grouped here?" → AI explains the matching rule, pattern, and priority logic in plain language.

**Integration point:** New context menu item. Can work with simple logic initially and be enhanced with AI for natural language explanations.

### Feature 5: Rule Conflict Detection & Resolution (Medium Impact)

**Problem:** No conflict detection between rules. Users can create overlapping rules without knowing.

**Solution:** When creating/editing a rule, AI analyzes all existing rules and flags overlaps with suggested resolutions.

**Integration point:** Validation step in the rules modal before saving.

## Technical Architecture

### Hybrid AI Provider System

```tree
AIProviderInterface
├── WebLLMProvider (default, client-side, privacy-first)
│   ├── Model: Qwen2.5-3B or similar small model
│   ├── Runs in browser via WebWorker
│   └── No API key required
└── ExternalAPIProvider (opt-in, higher quality)
    ├── Supports OpenAI, Claude, or other APIs
    ├── Requires user-provided API key
    └── Configurable model selection
```

### Key Design Decisions

| Aspect | WebLLM (Client-side) | External API |
| ------ | -------------------- | ------------ |
| Privacy | Excellent — nothing leaves browser | Requires sending tab data externally |
| Cost | Free after initial model download | Per-request cost, needs API key |
| Performance | Slower inference, ~1-7B models | Fast, powerful models |
| Offline | Works offline | Requires internet |
| Model size | 50MB-4GB download | Zero client overhead |
| Quality | Good for structured tasks | Better for nuanced understanding |

### Service Layer

New services to be added:

- `AIService.ts` — Orchestrates AI features, delegates to providers
- `AIProviderInterface.ts` — Common interface for all AI backends
- `WebLLMProvider.ts` — Client-side inference via WebLLM
- `ExternalAPIProvider.ts` — External API integration
- `PromptTemplates.ts` — Structured prompts for each feature

### Storage Additions

```typescript
// New storage fields
aiProvider: "webllm" | "external"       // Selected AI provider
externalApiKey?: string                  // Encrypted API key (if external)
externalApiEndpoint?: string             // Custom API endpoint
webllmModelId?: string                   // Selected WebLLM model
aiFeatureEnabled: boolean                // Master toggle for AI features
```

## Implementation Phases

### Phase 1: Foundation (AI Service Layer + WebLLM Integration)

- Implement `AIProviderInterface` abstraction
- Integrate WebLLM with web worker for non-blocking inference
- Add AI settings to storage and popup UI
- Build prompt template system

### Phase 2: Smart Rule Generation (Feature 1)

- Add "AI Assist" button to rules modal
- Natural language input → structured `CustomRule` output
- Pattern validation of AI-generated rules
- User review before rule creation

### Phase 3: Tab Grouping Suggestions (Feature 2)

- Add "Suggest Groups" button to popup/sidebar
- Tab analysis pipeline (collect titles + URLs → AI inference → suggestions)
- Suggestion UI with accept/reject actions
- One-click rule creation from accepted suggestions

### Phase 4: External API Provider (Optional Enhancement)

- Implement `ExternalAPIProvider`
- API key management UI with secure storage
- Provider switching in settings

### Phase 5: Advanced Features (Features 3-5)

- Content-aware grouping mode
- "Why is this tab here?" explainer
- Rule conflict detection

## Out of Scope

These were considered and intentionally excluded:

- **Auto-grouping every tab with AI** — too slow, domain-based grouping handles 90% of cases
- **Summarizing tab content** — out of scope for a tab grouping extension
- **Predicting which tabs to close** — too risky, would erode user trust
- **Always-on AI processing** — must be manual invocation only
