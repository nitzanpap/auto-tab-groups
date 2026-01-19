import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/**",
      ".output/**",
      ".wxt/**",
      "extension/**",
      "docs/**",
      "dist/**",
    ],
  },
  js.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        ...globals.node,
        browser: "readonly",
        chrome: "readonly",
        defineBackground: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      "prefer-const": "error",
      eqeqeq: ["error", "always"],
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: await import("typescript-eslint").then((m) => m.default.parser),
    },
    rules: {
      "no-unused-vars": "off",
    },
  },
];
