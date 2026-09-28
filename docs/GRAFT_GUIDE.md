# Graft Architecture & AI Context Engine Guide

This document provides a comprehensive guide on how **[Graft](https://github.com/trailhq/Graft)** is integrated into this repository, how it operates seamlessly within a containerized environment (Remote Docker VM), and **how AI coding agents automatically retrieve and utilize the architectural graph**.

---

## 1. Architectural Architecture & Environment Diagnosis

### The Universal Docker Architecture
This integration is engineered to be **100% host-agnostic and engine-agnostic**. It works seamlessly across:
1. **Remote Docker Daemons** (e.g. Linux VM or cloud server connected via Docker SSH Context).
2. **Local Docker Desktop** (Windows, macOS, or native Linux).
3. **CI/CD Pipelines** (GitHub Actions, GitLab CI, BuildKit runners).

### Why the Standard `docker run -v` Bind Mount Fails Across Environments
- Traditional volume bind mounts (`docker run -v "${PWD}:/workspace" ...`) only work when the Docker daemon and the client reside on the **exact same physical filesystem**.
- When using a Remote Docker VM or SSH Docker context, the host Windows drive (e.g. `D:\...`) does not exist on the Linux daemon, causing mount failures.

### The Universal Solution: Docker Buildx Multi-Stage Export
Instead of relying on fragile filesystem mounts:
1. **`docker/Dockerfile.graft`** installs Node 22, Git, tree-sitter tools, and `@nanonets/graft` inside an isolated container.
2. In the `builder` stage, Docker Buildx transmits the project context to the engine, runs `graft build`, and exports the interactive visualizer.
3. In the `export` stage (`FROM scratch`), Docker Buildx streams the generated `graft/` directory directly back to your local client directory.
*This guarantees that the exact same script works universally on local Docker Desktop, remote VMs, and CI runners without modifying a single line of configuration.*

---

## 2. How the AI Coding Agent Obtains the Architecture

When an AI coding agent (Antigravity IDE, Claude Code, Cursor, Codex) works on a repository without Graft, it starts **blind**: it executes dozens of costly `grep` and `find` commands, opens entire 1,000-line files, and burns tens of thousands of tokens just trying to figure out where functions are declared.

With Graft, the AI agent acquires full codebase understanding through **three distinct mechanisms**:

```
                       ┌──────────────────────────────────────────────┐
                       │               AI Coding Agent                │
                       │     (Antigravity, Claude Code, Cursor)       │
                       └──────────────────────┬───────────────────────┘
                                              │
              ┌───────────────────────────────┼───────────────────────────────┐
              ▼                               ▼                               ▼
     [Layer 1: Map Index]            [Layer 2: Wiring Cards]       [Layer 3: Dependency Graph]
       graft/INDEX.md               graft/services/*.md            graft/.graph/wiring.json
  Central subsystem index          Exact line ranges (L60-L82),     1,577 Call edges & AST
  and component overview           signatures & exported symbols    relationships (Who calls who)
              │                               │                               │
              └───────────────────────────────┼───────────────────────────────┘
                                              ▼
                       ┌──────────────────────────────────────────────┐
                       │          Targeted Code Inspection            │
                       │ Reads ONLY the specific lines (e.g. L60-L82) │
                       │    Result: ~50% Token & Latency Savings      │
                       └──────────────────────────────────────────────┘
```

### Mechanism A: Direct File-Based Markdown Traversal
Graft compiles the entire codebase AST into structured markdown documents located in [graft/](file:///d:/files/Contracted%20projects/google%20extensions/auto-tab-groups/graft):
1. **Central Index (`graft/INDEX.md`)**:
   - The AI agent opens this file first to orient itself with the directory structure, entry points, and high-level architectural domains.
2. **Subsystem Wiring Cards (`graft/<directory>/<file>.md`)**:
   - Every source file has a corresponding card (e.g. `graft/services/TabGroupService.md`).
   - Each card lists every class, method, function, and interface with its **exact line span** and signature:
     ```markdown
     - handleTabUpdate · method · L60-L82 — async handleTabUpdate(tabId: number, forceGrouping = false): Promise<boolean>
     - moveTabToTargetGroup · method · L214-L323 — async moveTabToTargetGroup(...)
     ```
3. **Surgical Precision**:
   - Instead of reading all 950 lines of `TabGroupService.ts`, the AI reads lines 60 to 82 directly.

### Mechanism B: Autonomous Agent Instruction (`CLAUDE.md` & `AGENTS.md`)
Both `CLAUDE.md` and `AGENTS.md` have been configured at the root of the workspace. When any agent session initializes:
- The system instructions mandate that the agent **must** consult `graft/INDEX.md` and the relevant `graft/*.md` cards prior to opening raw source code.
- This prevents hallucinated file exploration and enforces zero-token orientation.

### Mechanism C: AST Wiring Graph (`graft/.graph/wiring.json`)
The graph engine generates a machine-readable JSON representation containing:
- **630 AST Nodes**: Every function, method, interface, type alias, and class in the project.
- **1,577 Directed Edges**: Complete relationship mapping:
  - `calls`: Traces which functions invoke which methods across files.
  - `imports`: Identifies cross-module dependencies.
  - `contains`: Maps lexical symbol hierarchy.

---

## 3. Toolkit & Available Commands

### 1. Rebuilding the Architecture Graph
Whenever you add new files, restructure modules, or pull changes from Git, update the graph using:

```powershell
.\scripts\graft-build.ps1
```

- **Execution Time**: ~1.1 seconds (cached).
- **Docker Driver**: Runs in the remote Debian VM and exports `graft/` back to Windows.
- **Automated Hygiene**: Automatically cleans up dangling build layers (`docker image prune -f`) after every build to prevent any image mess or disk clutter.
- **Clean Rebuild**: Use `.\scripts\graft-build.ps1 -NoCache` to force a complete re-parse.

### 2. Instant Local Querying & Web GUI Visualizer
You can query the architectural graph directly in PowerShell without starting Docker:

```powershell
# 1. Zero-Token Repository Map (Orientation, Clusters, Hubs, Hotspots)
.\scripts\graft-query.ps1 map

# 2. Launch Interactive Web GUI Architecture Visualizer in browser
.\scripts\graft-query.ps1 gui

# 3. Search symbol definitions, file locations & line spans
.\scripts\graft-query.ps1 find handleTabUpdate

# 4. Trace who calls a specific method or function
.\scripts\graft-query.ps1 callers handleTabUpdate

# 5. View CLI help and all available commands
.\scripts\graft-query.ps1 help     # (or .\scripts\graft-query.ps1 -h)

# 6. View total graph metrics and usage
.\scripts\graft-query.ps1 stats

# 7. List all available architectural cards
.\scripts\graft-query.ps1 cards
```

---

## 4. End-to-End Developer & Agent Workflow

```
1. Developer / User
   │
   ├─► Runs `.\scripts\graft-build.ps1` ──► Updates `graft/` via Docker Buildx
   │
2. AI Agent Task Initiated
   │
   ├─► 1. Checks `AGENTS.md` & `CLAUDE.md`
   ├─► 2. Reads `graft/INDEX.md` or runs `.\scripts\graft-query.ps1 map`
   ├─► 3. Inspects `graft/services/TabGroupService.md` (Finds target method at L60-L82)
   ├─► 4. Reads lines 60-82 of `services/TabGroupService.ts`
   └─► 5. Implements change accurately with zero wasted context
```

---

## 5. File Inventory (Clean Workspace Layout)

| File Path | Role | Description |
| :--- | :--- | :--- |
| **`docker/Dockerfile.graft`** | Container Definition | Multi-stage Dockerfile containing Node 22, Git, tree-sitter toolchains, and Buildx export. |
| **`scripts/graft-build.ps1`** | Build Script | One-click PowerShell script to run the Docker build and export `graft/`. |
| **`scripts/graft-query.ps1`** | Query Utility | Fast, native PowerShell utility to search symbols, view GUI, and trace callers. |
| **`docs/GRAFT_GUIDE.md`** | Complete Guide | Full architectural reference and operational manual. |
| **`AGENTS.md`** | Agent Protocol | Directives instructing AI models to prioritize Graft before reading source files. |
| **`CLAUDE.md`** | Claude Guidelines | Updated development guide with Graft integration commands. |
| **`graft/`** | Context Directory | The generated AST graph, file cards, web visualizer, and central index (ignored in `.gitignore`). |
