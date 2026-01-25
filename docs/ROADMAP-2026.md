# Roadmap 2026

## Overview

Sequential approach: **UI/UX (Svelte + shadcn-svelte) → Bugs/Testing → WebLLM**

---

## Phase 1: UI/UX Redo with Svelte + shadcn-svelte

### Setup

```bash
bunx shadcn-svelte@next init
bun add @wxt-dev/module-svelte
```

### Components to Add

- button, switch, dialog, toast, collapsible, slider
- card, input, textarea, badge, separator, dropdown-menu

### Component Mapping

| shadcn Component | Extension Use Case |
| ---------------- | ------------------ |
| Switch | Auto-group mode, auto-collapse toggles |
| Dialog | Confirmation modals (delete rule, import replace) |
| Toast (Sonner) | Success/error notifications |
| Collapsible | Settings sections, custom rules accordion |
| Slider | Minimum tabs, collapse delay inputs |
| Card | Rule cards, settings panels |
| Input/Textarea | Rule name, domain patterns |
| Button | All action buttons |
| Badge | Rule count indicators |
| Dropdown Menu | Group-by mode selector |

### Migration Order

1. **Popup** - Create App.svelte, reduce 479 → ~200 lines
2. **Sidebar** - Reuse components, eliminate 92% duplication
3. **Rules Modal** - Svelte form with reactive validation
4. **Import Page** - File upload with Toast feedback

### UX Improvements

- Replace `alert()`/`confirm()` → shadcn Dialog
- Add Sonner toasts for notifications
- Built-in accessibility via Bits UI
- Svelte stores for state management
- Cross-UI sync via `browser.storage.onChanged`

---

## Phase 2: Bugs & Testing

### Test Coverage Gaps

**RulesService** (386 lines, 0% coverage):

- `findMatchingRule()` - rule matching logic
- CRUD: `addRule()`, `updateRule()`, `deleteRule()`
- `importRules()` - JSON parsing, validation, edge cases
- Target: 80%+ coverage

**Background Message Handlers** (410 lines):

- Extract to `services/MessageHandlers.ts`
- Add unit tests for each action type

### Bug Fixes

| Issue | Location | Fix |
| ----- | -------- | --- |
| Race condition in auto-collapse | background.ts:354-378 | Add debounce/mutex |
| Missing retry in groupMatchingUngroupedTabs | TabGroupService.ts:277-322 | Add retry with backoff |
| Incomplete null check | TabGroupService.ts:623-654 | Guard `activeTab?.groupId` |

### Code Quality

- Remove 57+ console.log statements
- Option: Replace with conditional debug logger

---

## Phase 3: WebLLM Research & Implementation

### Research Spike

**Browser Compatibility:**

- WebGPU support: Chrome 113+, Edge 113+
- Firefox: Behind flag (`dom.webgpu.enabled`)

**Model Evaluation:**

| Model | Size | Memory | Speed |
| ----- | ---- | ------ | ----- |
| Phi-3-mini | ~2GB | ~3GB | Medium |
| Qwen-0.5B | ~500MB | ~1GB | Fast |
| Gemma-2B | ~1.5GB | ~2GB | Medium |

### Feasibility Criteria

Proceed only if:

- [ ] WebGPU available in >80% of user browsers
- [ ] Model loads in <30 seconds
- [ ] Inference completes in <3 seconds
- [ ] Memory usage stays under 2GB
- [ ] Clear value over domain grouping

### Use Cases

1. **Smart categorization** - Group tabs by semantic similarity
2. **Auto-rule generation** - Suggest rules from browsing patterns
3. **Intelligent naming** - Generate descriptive group names

### Implementation (if feasible)

```text
services/
├── WebLLMService.ts        # Model loading, inference
├── TabAnalyzer.ts          # Prepare tab data for LLM
└── LLMFallback.ts          # Graceful degradation
```

**Design Decisions:**

- Progressive enhancement (works without LLM)
- User-triggered model download
- Model cached in IndexedDB
- Fallback to domain grouping

**Privacy:**

- All processing local (no data leaves browser)
- Only tab titles/URLs used
- No tracking of LLM usage

---

## Previously Completed

- [x] Domain-based auto tab grouping
- [x] URL pattern enhancement (domain+path, TLD wildcards, path wildcards)
- [x] Custom rules with colors and minimum tabs
- [x] Export/import rules
- [x] Pinned tab handling
- [x] Auto-collapse inactive groups with configurable delay

---

## Future Ideas (Post-Phase 3)

- [ ] Token system and usage tracking
- [ ] Payment and account system
- [ ] Cloud sync for rules
- [ ] Rule templates marketplace
- [ ] Query parameter matching
- [ ] Pattern testing interface
