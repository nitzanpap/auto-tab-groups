# Documentation Drift & Synchronization Report (v3.15.5)

**Audit Date**: 2026-09-28  
**Auditor Protocol**: `documentation-sync` & `graft-architecture-intelligence`  
**Repository State**: v3.15.5  
**AST Footprint**: 663 Nodes, 1,631 Edges  

---

## 1. Executive Summary

This forensic documentation synchronization audit was conducted across the Auto Tab Groups codebase to reconcile all architectural and functional documentation with the current executable source code for the **v3.15.5** release.

The audit detected major documentation drift across **Interface/API**, **Feature/Capability**, **Structural**, and **Configuration** dimensions. Specifically, previous documentation reflected only single-provider on-device WebLLM inference, omitted the new 3D knowledge graph visualizer, lacked coverage of the interactive tab comparison service, and did not document recent behavioral enhancements (tab positioning, read-later anchor pinning, and native MV3 Side Panel integration).

All obsolete claims have been purged and comprehensive English documentation artifacts have been synthesized.

---

## 2. Documentation Changes Summary

### Created / Reconstructed:
- **`docs/architecture.md`**: Complete system architecture, SSOT guidelines, directory clusters, service breakdown, and architectural invariants.
- **`docs/features.md`**: Comprehensive technical feature specifications including Tab Comparison, 3D Graph, Multi-Provider AI, Semantic Clustering, and Side Panel.
- **`docs/roadmap.md`**: Up-to-date milestone tracker categorizing completed v3.15.5 innovations and upcoming items with Todo Tree taxonomy.
- **`docs/reports/documentation-drift-report.md`**: This formal drift audit artifact.
- **`README.md`**: Synchronized feature list, architecture overview, and quick links.

---

## 3. Formal Forensic Drift Matrix

| Drift ID | Category | Document Path | Code Reference | Stale Document Claim | Code Reality (v3.15.5) | Severity | Remediation Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `DRIFT-FEAT-001` | FEAT | `docs/FEATURES.md:363` | `services/ai/ExternalAiProvider.ts` | "All AI features run entirely on-device using WebLLM" | Multi-provider architecture supports Ollama, LM Studio, OpenAI, and Groq | HIGH | Documented ExternalAiProvider and custom model management |
| `DRIFT-STRUCT-002` | STRUCT | `docs/ARCHITECTURE.md` | `entrypoints/graph-3d.unlisted/` | No mention of 3D visualizer or force-directed graph | Full 3D Force-Directed Graph module with Three.js and d3-force-3d | HIGH | Added 3D Graph architecture and module breakdown |
| `DRIFT-API-003` | API | `docs/FEATURES.md` | `services/TabComparisonService.ts` | Tab comparison workflow completely undocumented | Dedicated TabComparisonService with CMP badge and state restoration | HIGH | Added Tab Comparison feature specification and workflow |
| `DRIFT-FEAT-004` | FEAT | `docs/FEATURES.md` | `utils/SemanticGrouping.ts` | Only LLM prompt-based suggestions documented | Algorithmic cosine similarity clustering available (`smartGroupTabs`) | MEDIUM | Documented semantic clustering and threshold controls |
| `DRIFT-CONFIG-005`| CONFIG | `docs/ROADMAP.md` | `package.json:3` | Version listed as 3.15.4 | Version bumped to 3.15.5 with new dependencies (`3d-force-graph`, `three`) | MEDIUM | Synchronized package.json and roadmap |
| `DRIFT-WORKFLOW-006`| WORKFLOW| `docs/FEATURES.md` | `entrypoints/background.ts:1189` | New tabs immediately grouped or sent to System | Smart tab positioning puts new tabs beside active tab and defers grouping | MEDIUM | Documented smart positioning and deferred grouping logic |
| `DRIFT-FEAT-007` | FEAT | `docs/FEATURES.md` | `services/TabGroupService.ts:1418` | No mechanism to preserve leader tabs in bookmark groups | `enforceLaterGroupLeaderTab` locks anchor tab in Read Later group | LOW | Documented read later leader tab lock |

---

## 4. Documentation Coverage Scorecard

| Subsystem / Domain | Code Directory | Primary Document | Status | Evidence Check | Action Taken |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Core Grouping Engine** | `services/` | `docs/architecture.md` | FULL | Verified against `TabGroupService.ts` and `TabGroupState.ts` | Updated and verified |
| **Tab Comparison** | `services/TabComparisonService.ts` | `docs/features.md` | FULL | Verified against `TabComparisonService.test.ts` | Fully documented |
| **3D Knowledge Graph** | `entrypoints/graph-3d.unlisted/` | `docs/features.md` | FULL | Verified against `entrypoints/graph-3d.unlisted/` | Fully documented |
| **AI Orchestration** | `services/ai/` | `docs/architecture.md` | FULL | Verified against `AiService.ts` and `ExternalAiProvider.ts` | Fully documented |
| **Semantic Clustering** | `utils/SemanticGrouping.ts` | `docs/features.md` | FULL | Verified against `SemanticGrouping.ts` | Fully documented |
| **Docker Toolchain** | `docker/`, `scripts/` | `docs/DOCKER_GUIDE.md` | FULL | Verified against Dockerfiles and compose configs | Verified |
| **Graft Intelligence** | `scripts/graft-*` | `docs/GRAFT_GUIDE.md` | FULL | Verified against `scripts/graft-query.ps1` and AST map | Verified |

---

## 5. Architectural Quality Checklist

- [x] Every documented file path physically exists in the repository.
- [x] Every documented API message action matches an active handler in `entrypoints/background.ts`.
- [x] All documentation is written in clear, concise technical English.
- [x] Zero executable code files were mutated (only package.json version alignment).
- [x] Todo Tree workflow taxonomy (`TODO:P0`-`P3`) embedded for actionable follow-ups.
