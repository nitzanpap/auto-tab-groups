# Development Roadmap (v3.15.5)

## Completed Milestones

### Core Engine & Architecture
- [x] Domain-based auto tab grouping with public suffix resolution
- [x] URL pattern enhancements (domain+path, TLD wildcards, path wildcards)
- [x] Custom rules engine with colors, priority ordering, and minimum tab thresholds
- [x] Rule export and import via JSON
- [x] Pinned tab protection and tab bar origin anchoring
- [x] Focus Mode (auto-collapse inactive groups with exponential backoff)
- [x] Protected groups and manual group color persistence
- [x] Cross-window group consolidation with two-step safety preview

### Release v3.15.5 Innovations
- [x] **Interactive Tab Comparison Service**:
  - Two-tab A/B pairing workflow
  - Dynamic `CMP` action badge state indicator
  - Dedicated "Comparison" group with automatic restoration on cancel
- [x] **3D Force-Directed Knowledge Graph Visualizer**:
  - WebGL 3D force simulation using `3d-force-graph`, `three`, and `d3-force-3d`
  - Node clustering by window and tab group
  - Favicon texture mapping onto 3D spheres
  - Smooth camera focusing and direct tab activation
- [x] **Multi-Provider AI Architecture**:
  - WebLLM on-device local WebGPU inference
  - Local OpenAI-compatible server support (Ollama, LM Studio, vLLM)
  - Cloud OpenAI-compatible endpoint integration (OpenAI, Groq, DeepSeek)
  - Custom model registry and live connection diagnostics
- [x] **Semantic Tab Clustering**:
  - Cosine similarity text vector clustering across tab titles and URLs
  - Configurable similarity threshold (`aiSimilarityThreshold`)
  - One-click `smartGroupTabs` clustering engine
- [x] **Read Later Anchor Pinning**:
  - Invariant locking for the first tab in "Read Later" ("فيما بعد") groups
- [x] **Smart Tab Positioning**:
  - Position new tabs directly adjacent to the active anchor tab
  - Defer new tab URL grouping to prevent unintended bounces into System group
- [x] **Chrome Manifest V3 Side Panel**:
  - Native side panel behavior integration (`chrome.sidePanel`)
- [x] **Containerized Architecture Intelligence**:
  - Graft AST codebase wiring graph with zero-token map and CLI queries

---

## Active & Upcoming Roadmap

### AI & Machine Learning Pipeline
- [ ] Content-aware grouping utilizing on-page body text extraction (`TODO:P2 @dev #ai`)
- [ ] Autonomous AI regrouping daemon based on idle tab analysis (`TODO:P2 @dev #ai`)
- [ ] Explainability dialog: "Why was this tab grouped here?" (`TODO:P3 @dev #ai #ui`)
- [ ] Automatic rule conflict detector suggestions powered by LLM (`TODO:P2 @dev #ai #rules`)

### 3D Visualizer & UI Polish
- [ ] VR/XR immersive spatial tab management via WebXR (`TODO:P3 @dev #graph3d`)
- [ ] Real-time physics clustering fine-tuning controls in sidebar (`TODO:P2 @dev #graph3d #ui`)
- [ ] Search and filter overlay directly inside the 3D canvas (`TODO:P1 @dev #graph3d #ui`)
- [ ] Dark/Light mode synchronization for 3D canvas backdrop (`TODO:P2 @dev #ui`)

### Security, Performance & Sync
- [ ] Cloud sync for custom rules and color presets across browser profiles (`TODO:P1 @dev #storage #cloud`)
- [ ] Strict Content Security Policy (CSP) audit for WebLLM WebGPU workers (`TODO:P0 @dev #security`)
- [ ] Memory footprint optimization for long-running 3D graph sessions (`TODO:P1 @dev #perf #graph3d`)
