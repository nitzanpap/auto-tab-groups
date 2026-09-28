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
    bun install --ignore-scripts

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
RUN bun x wxt prepare && chown -R appuser:appgroup /workspace/app

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

# Default to long-running process for interactive IDE or compose attachment
CMD ["bun", "run", "dev"]

# ==============================================================================
# Stage 6: Local Artifact Export Target (`docker build --target export --output . .`)
# ==============================================================================
FROM scratch AS export
COPY --from=builder /workspace/app/.output/ .output/
COPY --from=builder /workspace/app/.wxt/ .wxt/
