# Roadmap

## Completed

- [x] Domain-based auto tab grouping
- [x] URL pattern enhancement (domain+path, TLD wildcards, path wildcards)
- [x] Custom rules with colors and minimum tabs
- [x] Export/import rules
- [x] Pinned tab handling
- [x] Focus Mode (auto-collapse inactive groups)
- [x] AI infrastructure (WebLLM on-device inference via WebGPU)
- [x] AI-powered rule generation from natural language
- [x] AI-powered tab group suggestions (topic-based grouping)
- [x] Suggestion caching across popup reopens

### AI Implementation Details (Completed)

**Phase 1 - AI Infrastructure**:

- WebLLM provider with dynamic `import()` (zero bundle cost until activated)
- AiService orchestrator with model lifecycle management
- WebGPU capability detection
- 6 model options (360MB to 3.8GB) with Qwen2.5 3B as recommended default
- Settings persistence across service worker restarts

**Phase 2 - Smart Rule Generation**:

- Natural language to rule conversion (e.g., "Group social media" -> domains + color)
- AI response parser with robust JSON extraction
- Integration with rules modal for review before saving

**Phase 3 - Tab Group Suggestions**:

- Topic-based grouping prompts (groups by subject, not domain)
- `response_format: json_object` for reliable structured output
- Suggestion cards with "Apply" and "Create Rule" actions
- Caching system so suggestions survive popup closes
- Applied/pending state tracking across reopens

## Planned

### AI Enhancements

- [ ] Content-aware grouping (analyze page content, not just URL/title)
- [ ] Autonomous AI mode (AI decides when to regroup tabs)
- [ ] "Why is this tab here?" explainer for group assignments
- [ ] Rule conflict detection and resolution suggestions

### UI Improvements

- [ ] Custom Rules UI enhancements (better visualization of priorities and conflicts)
- [ ] Search through open tabs and groups
- [ ] Filter by domain, group name, or custom rules
- [ ] Pattern testing interface for custom rules

### Security & Quality

- [ ] Enhanced XSS prevention
- [ ] Content Security Policy (CSP) updates
- [ ] Cloud sync for rules across devices

### Future Features

- [ ] Rule templates marketplace
- [ ] Query parameter matching in URL patterns
