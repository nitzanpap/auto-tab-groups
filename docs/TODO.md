# Auto Tab Groups Task Registry (Todo Tree Protocol)

> **Todo Tree Standard Format**: Optimized for automatic discovery, classification, and tracking across IDE activity bars and CI pipelines.

---

## 1. High-Priority Architectural & Security Tasks (`:P0` - `:P1`)

- [ ] `TODO:P0` Audit Content Security Policy (CSP) headers for WebLLM WebGPU workers in Firefox and Chrome MV3 @security #security #ai
- [ ] `TODO:P1` Implement real-time 3D node search and query filter overlay in graph visualizer @dev #graph3d #ui
- [ ] `TODO:P1` Add automated memory profile guards for WebGL 3D canvas during extensive browser sessions @perf #graph3d
- [ ] `TODO:P1` Establish end-to-end Playwright tests covering interactive tab comparison lifecycle @qa #tests #tabs
- [ ] `TODO:P1` Add sync adapter for exporting custom rules to user cloud storage or browser sync @dev #storage #sync

---

## 2. Feature Enhancements & UX Polish (`:P2`)

- [ ] `TODO:P2` Implement content-aware tab grouping by extracting page metadata and body text summaries @ai #ai
- [ ] `TODO:P2` Add dark/light theme reactive listeners to update 3D graph background color dynamically @ui #ui #graph3d
- [ ] `TODO:P2` Provide interactive physics configuration controls (charge, link distance, gravity) in 3D visualizer sidebar @graph3d #graph3d
- [ ] `TODO:P2` Implement automatic LLM-powered conflict resolution suggestions in Rules modal @rules #rules #ai
- [ ] `TODO:P2` Expand entity detection presets for additional regional services and developer consoles @utils #utils

---

## 3. Low-Priority Optimizations & Maintenance (`:P3`)

- [ ] `TODO:P3` Explore WebXR integration for spatial 3D tab group management on headsets @research #graph3d #xr
- [ ] `TODO:P3` Add explainability tooltip ("Why is this tab here?") for AI-assigned groups @ui #ai #ui
- [ ] `TODO:P3` Benchmark cosine similarity vs TF-IDF tokenization for tab semantic clustering speed @perf #utils
- [ ] `TODO:P3` Create rule templates marketplace with community presets @community #rules

---

## 4. Completed v3.15.5 Milestones

- [x] Implemented interactive Tab Comparison service (`TabComparisonService.ts`) with `CMP` toolbar badge #tabs
- [x] Engineered WebGL 3D Force-Directed Knowledge Graph visualizer (`entrypoints/graph-3d.unlisted/`) with favicon textures #graph3d
- [x] Architected multi-provider AI engine supporting WebLLM, local Ollama, and remote OpenAI-compatible endpoints #ai
- [x] Added semantic tab clustering via vector cosine similarity (`SemanticGrouping.ts`) #ai
- [x] Added Read Later leader tab locking (`enforceLaterGroupLeaderTab`) to keep anchor tab at index 0 #tabs
- [x] Integrated smart tab positioning to place new tabs adjacent to anchor active tabs #tabs
- [x] Integrated Chrome Manifest V3 Side Panel API with action fallback #ui
- [x] Added AST architecture layer and CLI tools powered by Graft #architecture
