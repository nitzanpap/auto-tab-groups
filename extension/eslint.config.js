import js from "@eslint/js"
import prettier from "eslint-config-prettier"
import prettierPlugin from "eslint-plugin-prettier"

export default [
  js.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        chrome: "readonly",
        browser: "readonly",
        console: "readonly",
        window: "readonly",
        document: "readonly",
        globalThis: "readonly"
      }
    },
    plugins: {
      prettier: prettierPlugin
    },
    rules: {
      "prettier/prettier": "error",
      "no-unused-vars": "warn",
      "no-console": "off",
      "no-debugger": "warn"
    }
  },
  {
    ignores: [
      "web-ext-artifacts/**",
      "*.zip",
      "*.xpi",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "src/manifest.json"
    ]
  }
]
