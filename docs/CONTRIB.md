# Contributing Guide

This document covers development workflow, available scripts, and testing procedures for Auto Tab Groups.

## Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js 18+
- Chrome or Firefox for testing
- WebGPU-capable GPU for AI feature testing (optional)

## Getting Started

```bash
# Install dependencies
bun install

# Start development mode (auto-reloads on changes)
bun run dev
```

## Available Scripts

| Script | Description |
| ------ | ----------- |
| `bun run dev` | Start WXT development server (default browser) |
| `bun run dev:chrome` | Start development server for Chrome |
| `bun run dev:firefox` | Start development server for Firefox |
| `bun run build` | Build production extension for Chrome |
| `bun run build:chrome` | Build production extension for Chrome |
| `bun run build:firefox` | Build production extension for Firefox |
| `bun run zip` | Build and create zip package for Chrome |
| `bun run zip:chrome` | Build and create zip package for Chrome |
| `bun run zip:firefox` | Build and create zip/xpi package for Firefox |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run test` | Run unit tests with Vitest |
| `bun run test:e2e` | Run end-to-end tests with Playwright |
| `bun run lint` | Run Biome linter |
| `bun run lint:fix` | Run Biome linter with auto-fix |
| `bun run format` | Format code with Biome |
| `bun run format:check` | Check code formatting |
| `bun run code:check` | Run Biome check and typecheck |
| `bun run code:fix` | Fix lint and formatting issues |

## Development Workflow

### 1. Start Development Server

```bash
bun run dev:chrome   # For Chrome
bun run dev:firefox  # For Firefox
```

This will:

- Build the extension in development mode
- Watch for file changes and auto-rebuild
- Output to `.output/chrome-mv3-dev/` or `.output/firefox-mv3-dev/`

### 2. Load Extension in Browser

**Chrome:**

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `.output/chrome-mv3-dev/`

**Firefox:**

1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select any file in `.output/firefox-mv3-dev/`

### 3. Make Changes

The development server watches for changes and auto-rebuilds. Refresh the extension in the browser to see updates.

### 4. Run Tests

```bash
# Unit tests
bunx vitest run

# Type checking
bun run typecheck

# Linting + typecheck
bun run code:check
```

**Note:** Use `bunx vitest run` instead of `bun test` for unit tests. Bun's built-in test runner has compatibility issues with `vi.hoisted()` and proper mock hoisting.

## Project Structure

```text
auto-tab-groups/
├── entrypoints/           # Extension entry points
│   ├── background.ts      # Service worker
│   ├── popup/             # Popup UI
│   ├── sidebar/           # Sidebar UI
│   └── rules-modal.unlisted/  # Rule editing modal
├── services/              # Business logic
│   ├── TabGroupService.ts
│   ├── RulesService.ts
│   ├── TabGroupState.ts
│   └── ai/               # AI layer
│       ├── AiService.ts   # AI orchestrator
│       └── WebLlmProvider.ts  # WebLLM backend
├── utils/                 # Utilities
│   ├── DomainUtils.ts
│   ├── UrlPatternMatcher.ts
│   ├── AiResponseParser.ts
│   ├── PromptTemplates.ts
│   ├── Constants.ts
│   └── storage.ts
├── types/                 # TypeScript type definitions
├── tests/                 # Unit tests (570+ tests)
├── public/                # Static assets (icons)
├── wxt.config.ts          # WXT configuration
└── package.json
```

## AI Development

### Architecture

The AI layer uses a provider pattern:

- **AiService** orchestrates model lifecycle and delegates to providers
- **WebLlmProvider** handles on-device inference via `@mlc-ai/web-llm`
- WebLLM is loaded via dynamic `import()` — never bundled unless activated

### Adding a New Model

1. Find the model ID in the [WebLLM model catalog](https://github.com/mlc-ai/web-llm)
2. Add to `AVAILABLE_MODELS` in `services/ai/WebLlmProvider.ts`
3. Update tests in `tests/WebLlmProvider.test.ts`

### Modifying Prompts

Prompts are in `utils/PromptTemplates.ts`. Key considerations:

- Small models (0.5B-3B) need explicit, structured instructions
- Use few-shot examples showing the exact expected JSON output
- Keep system messages concise (small context windows)
- Test with both Qwen and Llama models as they behave differently

### Testing AI Code

```bash
# Run all AI tests
bunx vitest run tests/AiService.test.ts tests/WebLlmProvider.test.ts tests/AiResponseParser.test.ts tests/PromptTemplates.test.ts

# Run with coverage
bunx vitest run --coverage
```

AI tests mock the WebLLM module entirely — no GPU required for unit tests.

## Testing

### Unit Tests

Unit tests are located in `tests/` and use Vitest:

```bash
bunx vitest run              # Run all tests
bunx vitest run --watch      # Watch mode
```

### End-to-End Tests

E2E tests use Playwright and require headed browser mode:

```bash
bun run test:e2e
```

## Code Quality

### Before Committing

1. Run code checks: `bun run code:check`
2. Run tests: `bunx vitest run`
3. Fix issues: `bun run code:fix`

### Coding Standards

- Use TypeScript for all new code
- Follow existing code patterns
- Add unit tests for new utilities
- Keep files focused (< 800 lines)
- Use immutable patterns (no mutation)
- Format with Biome (auto-applied via hooks)

## Building for Release

```bash
# Build and zip for both browsers
bun run zip:chrome
bun run zip:firefox
```

Output files:

- `.output/auto-tab-groups-{version}-chrome.zip`
- `.output/auto-tab-groups-{version}-firefox.zip`
