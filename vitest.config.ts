import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/extension/**", "legacy-extension/**", "tests/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "services/TabGroupState.ts",
        "services/TabGroupService.ts",
        "utils/Constants.ts",
        "utils/DomainUtils.ts",
        "utils/RulesUtils.ts",
        "utils/UrlPatternMatcher.ts"
      ],
      exclude: [
        "**/node_modules/**",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/index.ts",
        ".output/**",
        ".wxt/**",
        "legacy-extension/**",
        "entrypoints/**",
        "tests/**",
        // Services requiring browser API mocking (tested via E2E)
        "services/RulesService.ts",
        // WXT storage wrapper (requires runtime)
        "utils/storage.ts",
        // Type-only files
        "types/**"
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80
      }
    }
  }
})
