# 🐳 Docker Engineering & Operations Guide

> **Enterprise Containerization Standard for Auto Tab Groups**  
> Complete dual-architecture guide for building, testing, developing, and exporting browser extension distributions without installing Node.js or Bun on your host system.

---

## 📑 Table of Contents

1. [Architectural Overview](#1-architectural-overview)
2. [Dual-Architecture Deployment Matrix](#2-dual-architecture-deployment-matrix)
3. [Quick Start & One-Click Build](#3-quick-start--one-click-build)
4. [Multi-Stage Container Architecture](#4-multi-stage-container-architecture)
5. [Docker Compose Workflows](#5-docker-compose-workflows)
6. [Loading Built Extension in Browsers](#6-loading-built-extension-in-browsers)
7. [Rebuild Decision Matrix](#7-rebuild-decision-matrix)
8. [Remote Context Operations & Maintenance](#8-remote-context-operations--maintenance)
9. [Dangling Image Pruning (`dangling=true`)](#9-dangling-image-pruning-danglingtrue)
10. [Post-Development Cleanup: Freeing All Disk Space](#10-post-development-cleanup-freeing-all-disk-space)

---

## 1. Architectural Overview

Auto Tab Groups utilizes a **hermetic multi-stage containerization architecture** adhering to enterprise container security tenets:
- **Zero Host Tooling Dependency**: Neither Bun, Node.js, WXT, nor TypeScript are required on the host system.
- **Strict Non-Root Execution**: Container processes run under an unprivileged UID/GID (`10001:10001`, `appuser`).
- **Host Binary & Node Modules Isolation**: Volume isolation prevents Windows file structures or host dependencies from corrupting the Linux container runtime.
- **Direct Host Artifact Export**: The `export` target leverages Docker BuildKit client export (`--output type=local,dest=. .`) to write compiled distribution bundles (`.output/chrome-mv3`, `.output/firefox-mv3`, and `.zip` packages) directly to the host filesystem.

---

## 2. Dual-Architecture Deployment Matrix

| Feature | Architecture 1: Local Docker Engine | Architecture 2: Remote Docker Engine (Debian VM via SSH) |
| :--- | :--- | :--- |
| **Engine Location** | Local Host (Docker Desktop on Windows/macOS) | Remote Linux VM (e.g. `ssh://crowz-debian@192.168.85.129`) |
| **Active Context** | `docker context use default` | `docker context use debian-vm` |
| **Build & Export** | `.\scripts\docker-build.ps1` or `docker build -f docker/Dockerfile --target export` | `.\scripts\docker-build.ps1` or `docker build -f docker/Dockerfile --target export` |
| **Artifact Delivery** | Exported directly to `.output/` on host disk | Exported through Docker Client stream to `.output/` on host disk |
| **Live Code Bind Mount** | Instant hot-reloading across shared filesystem | Requires Samba/NFS/VMware shared folder or fast rebuilds (~1-2s) |

---

## 3. Quick Start & One-Click Build

### Option A: PowerShell Script (Windows)

```powershell
# Build extension and export all packages to .output/
.\scripts\docker-build.ps1

# Build, export, and run automated tests
.\scripts\docker-build.ps1 -RunTests

# Build, export, and launch static distribution preview on http://localhost:8080
.\scripts\docker-build.ps1 -Preview

# Skip automatic dangling builder layers cleanup
.\scripts\docker-build.ps1 -NoPrune
```

### Option B: Bash Script (Linux / macOS / WSL)

```bash
chmod +x ./scripts/docker-build.sh

# Build and export to .output/
./scripts/docker-build.sh

# Run tests as well
./scripts/docker-build.sh --test

# Launch preview server
./scripts/docker-build.sh --preview
```

### Option C: Direct Docker BuildKit CLI Command

```bash
# Export compiled Chrome MV3, Firefox MV3, and zip files directly to .output/
docker build -f docker/Dockerfile --target export --output type=local,dest=. .
```

After building, your `.output/` folder contains:
- `.output/chrome-mv3/`: Unpacked extension for Google Chrome & Chromium browsers.
- `.output/firefox-mv3/`: Unpacked extension for Mozilla Firefox.
- `.output/auto-tab-groups-*-chrome.zip`: Packaged zip for Chrome Web Store distribution.
- `.output/auto-tab-groups-*-firefox.zip`: Packaged zip for Firefox Add-ons (AMO).
- `.output/auto-tab-groups-*-sources.zip`: Complete source archive for Mozilla review.

---

## 4. Multi-Stage Container Architecture

The `Dockerfile` defines 7 specialized stages:

```text
[oven/bun:1-slim] (base)
       │
   [deps] (bun install --frozen-lockfile --ignore-scripts)
       │
   ┌───┴─────────────────────────────────┐
   ▼                                     ▼
[builder]                             [development]
(wxt prepare, tsc, wxt build, zip)     (wxt dev on :3000, hot reload)
   │
   ├──► [export] (scratch: copies .output/ directly to host filesystem)
   │
   ├──► [production] (caddy:2.8-alpine: hardened preview server on :8080)
   │
   └──► [test] (deterministic vitest test suite execution)
```

1. **`base`**: Stripped Debian runtime with Bun and non-root system user (`10001:10001`).
2. **`deps`**: Pre-installs exact locked dependencies with layer caching.
3. **`builder`**: Generates WXT types, runs TypeScript typecheck, compiles Chrome/Firefox MV3 outputs, and packages zip files.
4. **`test`**: Automated test executor running `bun run test`.
5. **`development`**: Mounts workspace with volume isolation for live editing.
6. **`production`**: Hardened, read-only Caddy server exposing preview on port 8080.
7. **`export`**: Minimal `scratch` stage used with `--output` to extract compiled output to the host.

---

## 5. Docker Compose Workflows

### 1. Interactive Development Server
```bash
docker compose up dev
```
Serves the WXT development server with hot-module reload on `http://localhost:3000`.

### 2. Run Tests
```bash
docker compose run --rm test
```
Executes the test suite in an isolated Linux environment.

### 3. CLI Utilities
```bash
# Run Biome linter
docker compose run --rm cli run lint

# Run type checking
docker compose run --rm cli run typecheck

# Check code formatting and types
docker compose run --rm cli run code:check
```

### 4. Hardened Artifact Preview Server
```bash
docker compose up -d preview
```
Browse and download extension packages via Caddy at `http://localhost:8080`.

---

## 6. Loading Built Extension in Browsers

### Google Chrome (and Chromium: Edge, Brave, Opera)
1. Open Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the folder:
   ```
   <repo-root>\.output\chrome-mv3
   ```
5. The Auto Tab Groups extension is now installed and active!

### Mozilla Firefox
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select `manifest.json` inside:
   ```
   <repo-root>\.output\firefox-mv3\manifest.json
   ```
4. The extension will appear in your Firefox toolbar.

---

## 7. Rebuild Decision Matrix

| Change Type | Architecture 1 (Local Docker Desktop) | Architecture 2 (Remote Debian VM) | Action Required |
| :--- | :--- | :--- | :--- |
| **Source Code Edit (`.ts`, `.html`, `.css`)** | Instant sync via bind mount | Run `.\docker-build.ps1` (takes ~2 seconds) | Fast rebuild & export |
| **Dependencies (`package.json`, `bun.lock`)** | Rebuild container image | Rebuild container image | `docker build` (invalidates `deps` cache) |
| **Dockerfile or Compose edits** | Rebuild container image | Rebuild container image | Full container rebuild |
| **New distribution release package** | Run `.\docker-build.ps1` | Run `.\docker-build.ps1` | Direct artifact export |

---

## 8. Remote Context Operations & Maintenance

If you are using a Remote Docker Engine (e.g. Debian server or VM via SSH Context):

### Check Active Context
```powershell
docker context ls
docker context show
```

### Switch Contexts
```powershell
# Switch to Remote VM
docker context use debian-vm

# Switch back to local Docker Desktop (if installed)
docker context use default
```

### Update Remote VM IP Address
If the VM IP changes (e.g. DHCP renewal):
```powershell
docker context update debian-vm --docker "host=ssh://crowz-debian@[IP_ADDRESS]"
```

### Test SSH Connectivity
```powershell
Test-NetConnection -ComputerName [IP_ADDRESS] -Port 22
```

---

## 9. Dangling Image Pruning (`dangling=true`)

Repeated multi-stage builds leave intermediate `<none>` images on the Docker host. Clean them with:

```powershell
# Inspect untagged dangling images
docker images -f "dangling=true"

# Prune all dangling images
docker image prune --filter "dangling=true" -f

# One-liner: Build, export and immediately prune intermediate layers
.\docker-build.ps1 -Prune
```

---

## 10. Post-Development Cleanup: Freeing All Disk Space

Once you have finished developing or building the extension and have exported the distribution packages to the `.output/` directory, you can reclaim all disk space on the Docker engine by tearing down project containers, isolated volumes, networks, temporary images, and the build cache.

### 🧹 1. Complete Post-Development Purge (Containers, Volumes, Networks & Cache)

```powershell
# 1. Tear down Compose containers, remove project network, and wipe isolated volumes
docker compose down -v --remove-orphans

# 2. Remove temporary images created during testing or manual builds
docker rmi auto-tab-groups:builder auto-tab-groups:test -f 2>$null

# 3. Purge BuildKit build cache and immediately reclaim disk space
docker builder prune -a -f

# 4. Prune unused anonymous volumes, networks, and untagged dangling images
docker volume prune -f
docker network prune -f
docker image prune -f
```

### ⚡ 2. One-Liner PowerShell Cleanup

Clean up everything related to this project (containers, volumes, networks, cache) in a single command:

```powershell
docker compose down -v --remove-orphans; docker builder prune -f; docker volume prune -f; docker network prune -f
```

Or directly using the build script with the `-Clean` switch:
```powershell
.\docker-build.ps1 -Clean
```

### 💡 Why Keep vs. Purge Build Cache?
- **During Active Development**: Docker keeps the **BuildKit Cache** and persistent volumes so that subsequent builds finish in **under 3 seconds** (`CACHED` layers).
- **After Work is Complete**: Once you have the finalized `.output/` bundles and no longer need rapid incremental rebuilds, running `.\docker-build.ps1 -Clean` completely wipes all temporary containers, networks, volumes, and build caches from the Docker engine.

