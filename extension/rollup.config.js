import { nodeResolve } from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"
import replace from "@rollup/plugin-replace"

export default {
  input: {
    background: "src/background.js",
    "public/popup": "src/public/popup.js",
    "public/rules-modal": "src/public/rules-modal.js",
    "public/import-rules": "src/public/import-rules.js"
  },
  output: {
    dir: "dist",
    format: "es",
    sourcemap: false,
    chunkFileNames: "chunks/[name]-[hash].js"
  },
  plugins: [
    replace({
      // Replace process.env.NODE_ENV for WebLLM
      "process.env.NODE_ENV": JSON.stringify("production"),
      preventAssignment: true
    }),
    nodeResolve({
      browser: true,
      preferBuiltins: false,
      exportConditions: ["browser", "import", "module", "default"]
    }),
    commonjs({
      include: ["node_modules/**"]
    })
  ],
  external: [
    // Don't bundle browser APIs
    "chrome",
    "browser"
  ],
  onwarn(warning, warn) {
    // Suppress certain warnings that are expected in browser extensions
    if (warning.code === "THIS_IS_UNDEFINED") return
    if (warning.code === "MISSING_GLOBAL_NAME") return
    warn(warning)
  }
}
