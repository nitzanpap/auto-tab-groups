import type { Plugin } from "vite"
import { defineConfig } from "wxt"

/**
 * Vite plugin that replaces @mlc-ai/web-llm with a lightweight stub for Firefox.
 * The full library bundles a 4.5 MB inline Emscripten tokenizer that pushes the
 * output chunk over the Firefox Add-on Store's 5 MB parse limit.
 * AI features (WebLLM/WebGPU) are Chrome-only for now.
 */
function stubWebLlmForFirefox(): Plugin {
  const STUB_ID = "\0webllm-stub"

  return {
    name: "stub-webllm-firefox",
    enforce: "pre",
    resolveId(id) {
      if (id === "@mlc-ai/web-llm") {
        return STUB_ID
      }
    },
    load(id) {
      if (id === STUB_ID) {
        return "export function CreateMLCEngine() { throw new Error('WebLLM is not available on Firefox') }"
      }
    }
  }
}

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifestVersion: 3,
  vite: ({ browser }) => ({
    plugins: browser === "firefox" ? [stubWebLlmForFirefox()] : []
  }),
  manifest: ({ browser }) => {
    const baseManifest = {
      name: "__MSG_extensionName__",
      description: "__MSG_extensionDescription__",
      default_locale: "en",
      author: "Nitzan Papini",
      permissions: ["tabs", "storage", "tabGroups", "contextMenus"],
      // No suggested_key anywhere on purpose: the browser then binds nothing on
      // install and these sit unassigned in its shortcuts page until the user
      // picks keys. Opting in is the user's move, and no existing shortcut of
      // theirs gets taken.
      commands: {
        _execute_action: {
          description: "__MSG_commandOpenPopup__"
        },
        "toggle-auto-grouping": {
          description: "__MSG_commandToggleAutoGrouping__"
        },
        "group-all-tabs": {
          description: "__MSG_commandGroupAllTabs__"
        },
        "ungroup-all-tabs": {
          description: "__MSG_commandUngroupAllTabs__"
        },
        "toggle-collapse": {
          description: "__MSG_commandToggleCollapse__"
        }
      },
      icons: {
        16: "icon/16.png",
        48: "icon/48.png",
        128: "icon/128.png"
      }
    }

    if (browser === "chrome") {
      return {
        ...baseManifest,
        // 'wasm-unsafe-eval' required for WebLLM: @mlc-ai/web-llm uses WebAssembly for model inference
        content_security_policy: {
          extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
        },
        side_panel: {
          default_path: "sidebar.html"
        }
      }
    }

    if (browser === "firefox") {
      return {
        ...baseManifest,
        browser_specific_settings: {
          gecko: {
            id: "{442789cf-4ff6-4a85-bf5b-53aa3282f1a2}",
            strict_min_version: "142.0",
            data_collection_permissions: {
              required: ["none"]
            }
          }
        },
        sidebar_action: {
          default_panel: "sidebar.html",
          default_icon: {
            16: "icon/16.png",
            48: "icon/48.png",
            128: "icon/128.png"
          },
          default_title: "__MSG_extensionName__"
        }
      }
    }

    return baseManifest
  }
})
