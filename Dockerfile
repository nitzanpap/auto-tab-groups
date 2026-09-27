# syntax=docker/dockerfile:1.7

# ==============================================================================
# Stage 1: Base Runtime Engine & System Dependencies
# ==============================================================================
FROM oven/bun:1-slim AS base

LABEL maintainer="Auto Tab Groups Team" \
      description="Production-grade containerized environment for Auto Tab Groups extension"

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    BUN_INSTALL_CACHE_DIR=/root/.bun/install/cache

WORKDIR /workspace/app

# Install minimal system tools needed for native tools, build & healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged application user and group (UID/GID 10001:10001)
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -M -s /sbin/nologin -d /workspace/app appuser && \
    mkdir -p /workspace/app && \
    chown -R appuser:appgroup /workspace/app

# ==============================================================================
# Stage 2: Hermetic Dependency Installation (Cached Layer)
# ==============================================================================
FROM base AS deps

WORKDIR /workspace/app

# Copy dependency specifications first to maximize layer cache efficiency
COPY --chown=appuser:appgroup package.json bun.lock ./

# Install all dependencies (including devDependencies required for building/testing)
# Using BuildKit cache mount to accelerate repeated builds
# --ignore-scripts prevents postinstall (wxt prepare) from running before source code is copied
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts

# ==============================================================================
# Stage 3: Builder - Extension Compilation & Packaging
# ==============================================================================
FROM deps AS builder

WORKDIR /workspace/app

# Copy full application source code
COPY --chown=appuser:appgroup . .

# Generate WXT types and config (.wxt/tsconfig.json), then typecheck, build, and zip both browser extensions
RUN bun x wxt prepare && \
    bun run typecheck && \
    bun run build:chrome && \
    bun run build:firefox && \
    bun run zip:chrome && \
    bun run zip:firefox

# ==============================================================================
# Stage 4: Test Runner (Automated Testing & Code Quality Assurance)
# ==============================================================================
FROM deps AS test

WORKDIR /workspace/app

COPY --chown=appuser:appgroup . .

# Prepare WXT types and generate runtime environment
RUN bun x wxt prepare

USER 10001:10001

ENTRYPOINT ["bun", "run"]
CMD ["test"]

# ==============================================================================
# Stage 5: Interactive Development Target (Supports Live Code Mounts)
# ==============================================================================
FROM deps AS development

WORKDIR /workspace/app

COPY --chown=appuser:appgroup . .
RUN bun x wxt prepare

# Ensure proper permissions for runtime cache
RUN mkdir -p /workspace/app/.wxt /workspace/app/.output /workspace/app/node_modules && \
    chown -R appuser:appgroup /workspace/app

USER 10001:10001

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["curl", "-f", "http://127.0.0.1:3000/"]

# Default to long-running process for interactive IDE or compose attachment
CMD ["bun", "run", "dev"]

# ==============================================================================
# Stage 6: Hardened Production Runtime (Artifact Delivery & Web Preview)
# ==============================================================================
FROM caddy:2.8-alpine AS production

LABEL description="Hardened static server for Auto Tab Groups preview & distribution"

# Setup unprivileged user
RUN addgroup -g 10001 -S appgroup && \
    adduser -u 10001 -S -G appgroup -s /sbin/nologin appuser && \
    mkdir -p /srv /data /config && \
    chown -R appuser:appgroup /srv /data /config

WORKDIR /srv

# Copy compiled extension build outputs and zip archives from builder
COPY --from=builder --chown=appuser:appgroup /workspace/app/.output/ ./output/
COPY --from=builder --chown=appuser:appgroup /workspace/app/public/ ./public/

# Drop all privileges
USER 10001:10001

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["caddy", "status"]

# Serve the build artifacts via internal Caddy file server
CMD ["caddy", "file-server", "--listen", ":8080", "--root", "/srv/output", "--browse"]

# ==============================================================================
# Stage 7: Local Artifact Export Target (`docker build --target export --output . .`)
# ==============================================================================
FROM scratch AS export
COPY --from=builder /workspace/app/.output/ .output/
