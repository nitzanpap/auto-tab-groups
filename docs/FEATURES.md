# Features Specification (v3.15.5)

## Table of Contents
1. [Core Auto-Grouping & Tab Management](#1-core-auto-grouping--tab-management)
2. [Interactive Tab Comparison (New in v3.15.5)](#2-interactive-tab-comparison-new-in-v3155)
3. [Interactive 3D Tab Knowledge Graph (New in v3.15.5)](#3-interactive-3d-tab-knowledge-graph-new-in-v3155)
4. [Multi-Provider AI & External LLM Integration (New in v3.15.5)](#4-multi-provider-ai--external-llm-integration-new-in-v3155)
5. [Semantic Tab Clustering (New in v3.15.5)](#5-semantic-tab-clustering-new-in-v3155)
6. [Read Later Group Leader Tab Pinning (New in v3.15.5)](#6-read-later-group-leader-tab-pinning-new-in-v3155)
7. [Smart Position: Open Tab Next to Current Tab (New in v3.15.5)](#7-smart-position-open-tab-next-to-current-tab-new-in-v3155)
8. [Chrome Side Panel MV3 Integration (New in v3.15.5)](#8-chrome-side-panel-mv3-integration-new-in-v3155)
9. [Protected Groups & Manual Color Persistence](#9-protected-groups--manual-color-persistence)
10. [Focus Mode & Auto-Collapse](#10-focus-mode--auto-collapse)
11. [Cross-Window Group Consolidation](#11-cross-window-group-consolidation)

---

## 1. Core Auto-Grouping & Tab Management

Auto Tab Groups automatically organizes browser tabs into domain or rule-based tab groups.
- **Domain Extraction**: Resolves clean domain names using public suffix lists (e.g. `github.com`, `docs.google.com`).
- **Custom Rules**: Supports exact URLs, domain wildcards (`*.github.com`), TLD wildcards (`google.*`), path wildcards (`github.com/org/*`), and title matching rules.
- **Minimum Tab Threshold**: Configure minimum tabs required before forming a group (e.g. 2 or 3 tabs).
- **Pinned Tabs**: Pinned tabs are permanently excluded from auto-grouping and remain at the tab bar origin.

---

## 2. Interactive Tab Comparison (New in v3.15.5)

The Tab Comparison Service enables seamless A/B comparison between two tabs:

### Workflow:
1. **Initiate**: The user triggers "Compare Tabs" from the popup, sidebar, or shortcut on Tab A (source tab).
2. **Badge Indicator**: The extension toolbar badge immediately displays `CMP` with a purple accent color.
3. **Target Selection**: The user clicks or switches to Tab B (target tab).
4. **Auto-Grouping**: Tabs A & B are automatically moved into a dedicated group named `"Comparison"` with color `purple`.
5. **Session Resolution**: The `CMP` badge clears automatically, and the comparison session is stored.
6. **Restoration / Cancelation**: Clicking "Cancel Comparison" dissolves the comparison group and restores both Tab A and Tab B back to their original parent group IDs.

---

## 3. Interactive 3D Tab Knowledge Graph (New in v3.15.5)

An interactive WebGL 3D Force-Directed Graph visualizing your browser workspace in three dimensions.

### Capabilities:
- **Spatial Topology**: Visualizes Windows as top-level anchors, Tab Groups as colored clusters, and individual tabs as orbiting leaf nodes.
- **Favicon Textures**: Domain favicons are extracted and rendered as textures directly onto 3D spheres.
- **Interactive Focus & Camera**:
  - Click any tab node to focus camera on it with smooth spherical tweening.
  - Double-click or click "Activate Tab" to immediately switch the physical browser window and tab to the selected node.
- **Real-time Synchronization**: Responds to live browser tab events (create, close, move, update).
- **Dedicated Sidebar**: Displays tab title, domain, URL, and group color with quick navigation controls.
- **Launch Vector**: Open via the popup/sidebar button or direct action message `openGraph3d`.

---

## 4. Multi-Provider AI & External LLM Integration (New in v3.15.5)

The AI subsystem has been re-architected from single-provider (WebLLM) to a flexible multi-provider engine.

### Supported Providers:
1. **On-Device WebLLM**: Runs locally inside browser worker via WebGPU (`@mlc-ai/web-llm`). Models include Qwen2.5 3B, Llama 3.2 3B, and Phi-3.5 Mini.
2. **Local OpenAI-Compatible Server (Ollama / LM Studio / vLLM)**: Connects to local inference servers at customizable endpoints (e.g., `http://localhost:11434/v1` for Ollama).
3. **Cloud OpenAI-Compatible APIs (OpenAI, Groq, Together, DeepSeek)**: Direct API integration supporting custom endpoints and bearer API keys.

### Features:
- **Custom Model Management**: Add, edit, and delete custom model configurations (`addCustomAiModel`, `removeCustomAiModel`).
- **Live Connection Diagnostics**: Dedicated "Test Connection" button (`testAiConnection`) validates endpoint reachability and model availability before running queries.
- **AI Rule Generation**: Convert natural language descriptions into custom regex/domain tab grouping rules.
- **AI Tab Group Suggestions**: Intelligently groups open tabs by semantic topic rather than domain.

---

## 5. Semantic Tab Clustering (New in v3.15.5)

- **Algorithmic Cosine Clustering**: Leverages text vectorization across tab titles, domain tokens, and URL paths to identify semantic clusters without requiring external cloud embeddings.
- **Configurable Similarity Threshold**: Users can adjust clustering sensitivity (`aiSimilarityThreshold`, default `0.6`).
- **One-Click Smart Grouping**: Trigger `smartGroupTabs` from popup/sidebar to instantly categorize messy multi-tab research sessions.

---

## 6. Read Later ("فيما بعد") Group Leader Tab Pinning (New in v3.15.5)

- **Problem Addressed**: In "Read Later" or bookmarking groups, users often designate the first tab as an index, notes document, or anchor. Moving or sorting tabs inside the group could inadvertently displace this anchor tab.
- **Behavior**: When `lockLaterGroupFirstTab` is enabled, the designated leader tab (`laterGroupLeaderTabId`) is locked at index 0 of the group. If any other tab is dragged or moved before it, `enforceLaterGroupLeaderTab` automatically restores the leader tab to the start of the group.

---

## 7. Smart Position: Open Tab Next to Current Tab (New in v3.15.5)

- When `openTabNextToCurrent` is enabled:
  - Newly opened tabs (via link click or shortcut) are positioned directly next to the active tab (`index: anchorTab.index + 1`).
  - If the active tab belongs to a group, the new tab temporarily joins that group until navigated.
  - New tab URLs (`chrome://newtab`, `about:blank`) defer grouping until real destination URLs load, preventing tabs from prematurely bouncing into the System group.

---

## 8. Chrome Side Panel MV3 Integration (New in v3.15.5)

- Full integration with Chrome's native Side Panel API (`chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`).
- Allows keeping Auto Tab Groups persistent in a browser side panel alongside web browsing.
- Includes fallback handlers for Firefox and unsupported Chromium builds.

---

## 9. Protected Groups & Manual Color Persistence

- **Manual Color Retention**: When a user changes a tab group color using the browser's native color picker, Auto Tab Groups records the selection and persists it across sessions.
- **Protected Groups**: Excluded groups are never dissolved by auto-grouping or "Ungroup All".
- **System Group Sanitization**: The background worker guarantees that the reserved "System" group is never accidentally added to the protected groups list.

---

## 10. Focus Mode & Auto-Collapse

- Automatically collapses inactive tab groups when switching between tabs.
- Keeps the active tab's group expanded for distraction-free navigation.
- Exponential backoff ensures reliable collapse without race conditions.

---

## 11. Cross-Window Group Consolidation

- Identifies identical groups split across multiple browser windows.
- Provides a safe two-step preview and consolidation workflow to merge groups into their primary window.
