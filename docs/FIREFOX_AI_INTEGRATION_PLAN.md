# Firefox AI Integration Plan

## Problem Statement

WebLLM (`@mlc-ai/web-llm`) is disabled on Firefox because its bundled 4.5 MB inline Emscripten tokenizer pushes output chunks over the Firefox Add-on Store's **5 MB per-file parse limit**. This means Firefox users currently have zero access to the extension's AI features (smart rule generation, tab grouping suggestions, conflict detection).

We need a privacy-focused, on-device AI solution that works within Firefox's constraints.

## Research Summary

### Options Evaluated

#### 1. `browser.trial.ml` — Firefox's Built-in AI Runtime

Firefox ships a trial API (`browser.trial.ml`) that wraps Transformers.js + ONNX runtime. Extensions can use it to run ML tasks on-device.

**Supported tasks include:** text-classification, token-classification, question-answering, summarization, translation, text2text-generation, **text-generation**, zero-shot-classification, image-to-text, image-to-image, feature-extraction, and more.

**API surface:**
- `browser.trial.ml.createEngine({ taskName, modelHub, modelId })` — create an inference engine
- `browser.trial.ml.runEngine({ args: [...] })` — run inference
- `browser.trial.ml.onProgress.addListener(callback)` — progress events
- `browser.trial.ml.deleteCachedModels()` — cleanup

**Permission:** `"optional_permissions": ["trialML"]`

**Key limitations:**
- **Experimental** — lives under `browser.trial` namespace, API will change between Firefox versions
- **Nightly-only by default** — Beta/Release require manually toggling `browser.ml.enable` and `extensions.ml.enabled` in `about:config`
- **Model restrictions** — only Xenova and Mozilla org models on HuggingFace allowed
- **Task-based pipeline, not chat completions** — `text-generation` produces text continuations, not instruction-following chat responses
- **No structured JSON output** — no schema enforcement or JSON mode
- **CPU-only by default** — slow inference
- **No parallel engines** — can only run one engine at a time
- **Not suitable for our use case** — our features require structured JSON from chat-style prompts (rule generation, tab suggestions), which this pipeline API doesn't support well

**Verdict: Not viable as the primary provider.** The task-based pipeline model doesn't map to our chat-completions architecture. It could serve as a lightweight fallback for simpler tasks (zero-shot-classification for basic tab categorization) in the future, but cannot replicate the structured JSON generation our features require.

#### 2. wllama — WebAssembly Binding for llama.cpp ✅ RECOMMENDED

wllama provides WebAssembly bindings for llama.cpp, enabling full LLM inference in the browser using GGUF-format models. Firefox has **explicitly enabled wllama for extensions** ([Bug 1976704](https://bugzilla.mozilla.org/show_bug.cgi?id=1976704)), and Firefox 142+ supports it.

**Key capabilities:**
- `createChatCompletion(messages, options)` — chat-style API with template support
- `createCompletion(prompt, options)` — raw text completion with streaming
- Runs in a Web Worker (non-blocking UI)
- Supports GGUF quantized models (Q4, Q5, Q6)
- Loads models from HuggingFace or URLs
- Supports model splitting for files > 2GB
- Single-thread and multi-thread WASM builds (auto-detected)
- No runtime dependencies

**Why it fits:**
- **Chat completions API** — `createChatCompletion` maps directly to our existing `AiCompletionRequest` / `AiCompletionResponse` interface
- **GGUF model ecosystem** — access to Qwen, Phi, Llama, and other instruction-tuned models in quantized form
- **No file size issue** — the wllama library itself is small; models are downloaded separately at runtime
- **Firefox-blessed** — Mozilla explicitly worked on enabling this for extensions
- **Privacy-first** — everything runs on-device, no data leaves the browser
- **Works on Firefox stable** — not limited to Nightly like `browser.trial.ml`
- **`wasm-unsafe-eval` CSP supported** — Firefox MV3 supports this directive (same as Chrome)

**Limitations:**
- **CPU-only** — no WebGPU acceleration (slower than WebLLM on Chrome)
- **2GB ArrayBuffer limit** — models must be split if larger (most Q4 3B models are under 2GB)
- **No grammar-level JSON enforcement** — must rely on prompt engineering for structured output (same as most non-WebLLM approaches)
- **Multi-threading requires COOP/COEP headers** — may fall back to single-thread in extension context

#### 3. `browser.trial.ml` for lightweight tasks + wllama for chat (Hybrid)

Use `browser.trial.ml` for quick classification tasks (zero-shot tab categorization) and wllama for the heavy lifting (rule generation, suggestions). This adds complexity for marginal benefit and ties part of the feature set to a Nightly-only API. **Not recommended for initial implementation** but could be explored later.

## Recommended Architecture

### New Provider: `WllamaProvider`

Create a new `WllamaProvider` class implementing the existing `AiProviderInterface`. This slots into the current provider system alongside `WebLlmProvider`:

```
AiProviderInterface
├── WebLlmProvider    (Chrome — WebGPU via @mlc-ai/web-llm)
├── WllamaProvider    (Firefox — WASM via @wllama/wllama)  ← NEW
└── ExternalAPIProvider (future — API key required)
```

### Provider Selection Logic

```
AiService.getActiveProvider():
  if browser === "firefox"  → WllamaProvider
  if browser === "chrome"   → WebLlmProvider
  (future: if user chose external → ExternalAPIProvider)
```

The provider is selected automatically based on the browser. Users don't need to choose — they just enable AI and the right backend is used. The settings UI adapts to show provider-appropriate model options.

### AiProvider Type Update

```typescript
// Current
type AiProvider = "webllm" | "external"

// Updated
type AiProvider = "webllm" | "wllama" | "external"
```

## Implementation Plan

### Phase 1: wllama Provider Foundation

**Files to create:**
- `services/ai/WllamaProvider.ts` — implements `AiProviderInterface`

**Files to modify:**
- `types/ai.ts` — add `"wllama"` to `AiProvider` union, update `AiModelConfig` (remove `vramRequiredMb` requirement or make optional since wllama is CPU-only)
- `services/ai/AiService.ts` — import `WllamaProvider`, add browser detection, route to correct provider
- `wxt.config.ts` — add `wasm-unsafe-eval` to Firefox CSP (currently only Chrome has it), remove or keep the WebLLM stub (it's still needed since WebLLM itself shouldn't be bundled for Firefox)
- `utils/storage.ts` — update default `aiProvider` to be browser-aware
- `types/storage.ts` — update `DEFAULT_STATE.aiProvider` to be browser-aware
- `package.json` — add `@wllama/wllama` dependency

**WllamaProvider implementation details:**

```typescript
class WllamaProvider implements AiProviderInterface {
  // Available GGUF models (hosted on HuggingFace)
  // Use small quantized instruction-tuned models:
  // - Qwen2.5-3B-Instruct Q4_K_M (~1.8GB) — best quality/size ratio
  // - Phi-3.5-mini Q4_K_M (~2.0GB) — good at structured output
  // - SmolLM2-1.7B-Instruct Q4_K_M (~1.0GB) — faster, lighter

  async loadModel(modelId: string): Promise<void> {
    // 1. Create Wllama instance with WASM paths
    // 2. Call loadModelFromHF(repoId, fileName, { progressCallback })
    // 3. Update status: idle → loading → ready
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    // 1. Convert AiChatMessage[] to wllama chat format
    // 2. Call wllama.createChatCompletion(messages, {
    //      nPredict: request.maxTokens ?? 512,
    //      sampling: { temp: request.temperature ?? 0.7 }
    //    })
    // 3. Parse response, return as AiCompletionResponse
  }

  async isAvailable(): Promise<boolean> {
    // Check if WebAssembly is available (virtually always true)
    return typeof WebAssembly !== "undefined"
  }
}
```

### Phase 2: Build System Integration

**`wxt.config.ts` changes:**

1. Add `wasm-unsafe-eval` to Firefox MV3 CSP:
   ```typescript
   // Both browsers now need wasm-unsafe-eval
   content_security_policy: {
     extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
   }
   ```

2. Keep the WebLLM stub for Firefox (still needed — prevents bundling the 4.5MB tokenizer)

3. Consider stubbing wllama for Chrome (optional — avoids bundling unused WASM files in Chrome build):
   ```typescript
   function stubWllamaForChrome(): Plugin {
     // Similar to stubWebLlmForFirefox but for @wllama/wllama
   }
   ```

4. WASM file handling — wllama ships pre-built WASM binaries that need to be accessible at runtime. Options:
   - Copy WASM files to `public/` directory during build
   - Use CDN for WASM files (not recommended for privacy)
   - Bundle as extension assets via WXT's `public` directory

### Phase 3: Model Management

**Model selection for Firefox:**

| Model | Size | Speed | Quality | Notes |
|-------|------|-------|---------|-------|
| Qwen2.5-3B-Instruct Q4_K_M | ~1.8 GB | Moderate | Good | Best overall for structured JSON tasks |
| Phi-3.5-mini-instruct Q4_K_M | ~2.0 GB | Moderate | Good | Strong at following instructions |
| SmolLM2-1.7B-Instruct Q4_K_M | ~1.0 GB | Fast | Acceptable | Good for resource-constrained devices |

Models are downloaded from HuggingFace on first use (same UX as WebLLM on Chrome). The download progress is reported through the existing progress UI.

**Model storage:** wllama caches models in IndexedDB. Unlike WebLLM which uses the Cache API, this works well within Firefox's storage model.

### Phase 4: Prompt Compatibility

The existing prompt templates (`utils/PromptTemplates.ts`) use a chat message format (`AiChatMessage[]`) that maps directly to wllama's `createChatCompletion` API. **No changes needed to prompts.**

However, since wllama doesn't support grammar-level JSON schema enforcement like WebLLM does:
- The `responseSchema` field in `AiCompletionRequest` will be ignored by `WllamaProvider`
- The existing `AiResponseParser.ts` already handles lenient JSON parsing (strips markdown fences, extracts JSON objects) — this robustness becomes more important
- Consider adding a retry mechanism: if JSON parsing fails, re-prompt with a correction hint

### Phase 5: UI Adaptations

**Settings panel changes:**
- Show "AI Provider" as informational (auto-detected based on browser), not a dropdown
- Display provider-specific model list (GGUF models for Firefox, MLC models for Chrome)
- Show "CPU inference" badge for Firefox (vs "WebGPU" for Chrome)
- Adjust progress/download messaging (wllama downloads may be larger single files)

**Capability detection:**
- Replace WebGPU checks with WebAssembly checks for Firefox
- Update `utils/WebGpuUtils.ts` or create `utils/AiCapabilityUtils.ts` to abstract capability detection per browser

## Key Decisions

### Why wllama over `browser.trial.ml`

| Aspect | wllama | browser.trial.ml |
|--------|--------|-----------------|
| API style | Chat completions (matches our code) | Task pipeline (doesn't match) |
| Structured JSON | Via prompt engineering (workable) | Not supported |
| Browser support | Firefox stable (142+) | Firefox Nightly only |
| Model choice | Any GGUF model | Xenova/Mozilla only |
| Stability | Stable library | Trial API, will change |
| Our code changes | New provider only | Would need architecture rework |

### Why not use wllama on Chrome too?

WebLLM on Chrome uses **WebGPU** for GPU-accelerated inference, which is dramatically faster than wllama's CPU-based WASM inference. Chrome users get a better experience with WebLLM. Using wllama on Chrome would be a downgrade.

### Performance Expectations

CPU-based inference via wllama will be noticeably slower than WebGPU-based WebLLM on Chrome. For a 3B parameter Q4 model:
- **Chrome (WebLLM/WebGPU):** ~10-30 tokens/sec depending on GPU
- **Firefox (wllama/WASM):** ~2-8 tokens/sec depending on CPU

This is acceptable for our use case because:
1. All AI features are manually triggered (user expects a wait)
2. Responses are short (JSON objects, typically < 200 tokens)
3. Loading indicator already exists in the UI

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| wllama WASM files too large for Firefox add-on store | Low | WASM files are ~2-5MB each, well under limits. Models are downloaded separately. |
| Model download too slow for users | Medium | Offer smaller models (SmolLM 1.7B at ~1GB). Show clear progress UI. |
| JSON output quality with CPU models | Medium | Existing lenient parser handles most cases. Add retry with correction prompt. |
| Firefox drops WASM support in extensions | Very Low | WASM is a web standard. Mozilla actively supports it. |
| `browser.trial.ml` matures and becomes better | Medium | Can add as additional provider later without disrupting wllama. |

## Future Considerations

- **`browser.trial.ml` as supplementary provider:** Once it stabilizes and reaches Firefox Release, it could handle lightweight tasks (zero-shot-classification for quick tab categorization) without needing a full LLM download
- **WebGPU in wllama:** The wllama project may add WebGPU support in the future, which would significantly improve Firefox performance
- **Shared model cache:** If both extensions and Firefox internals use the same models, `browser.trial.ml` could avoid duplicate downloads

## Sources

- [Mozilla Blog — Running inference in web extensions](https://blog.mozilla.org/en/firefox/firefox-ai/running-inference-in-web-extensions/)
- [Firefox Source Docs — WebExtensions AI API](https://firefox-source-docs.mozilla.org/toolkit/components/ml/extensions.html)
- [Firefox Source Docs — Trial API Example](https://firefox-source-docs.mozilla.org/toolkit/components/ml/extensions-api-example/README.html)
- [William Durand — Firefox AI & WebExtensions](https://williamdurand.fr/2025/03/24/firefox-ai-and-webextensions/)
- [Tom Ayac — Playing with AI inference in Firefox](https://blog.tomayac.com/2025/02/07/playing-with-ai-inference-in-firefox-web-extensions/)
- [Phoronix — Firefox 142 Extensions AI LLMs](https://www.phoronix.com/news/Firefox-142-Extensions-AI-LLMs)
- [wllama GitHub](https://github.com/ngxson/wllama)
- [wllama npm](https://www.npmjs.com/package/@wllama/wllama)
- [Bugzilla — Enable wllama for extensions](https://bugzilla.mozilla.org/show_bug.cgi?id=1976704)
- [MDN — content_security_policy for extensions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_security_policy)
