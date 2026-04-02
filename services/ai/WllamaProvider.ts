/**
 * wllama provider implementation for Firefox
 * Uses WebAssembly (llama.cpp) for on-device LLM inference.
 * Firefox cannot use WebLLM due to its 4.5 MB tokenizer exceeding the
 * add-on store's 5 MB per-file limit, so we use wllama (WASM) instead.
 */

import type {
  AiCompletionRequest,
  AiCompletionResponse,
  AiModelConfig,
  AiModelStatus
} from "../../types"
import type { AiProviderInterface } from "./AiProviderInterface"

/**
 * Model definitions for wllama (GGUF format, downloaded from HuggingFace)
 *
 * Each entry specifies:
 * - hfRepoId: HuggingFace repository (org/model)
 * - hfFilePath: path to the GGUF file within the repo
 *
 * Models are Q4_K_M quantized for a good quality/size tradeoff on CPU.
 */
interface WllamaModelConfig extends AiModelConfig {
  hfRepoId: string
  hfFilePath: string
}

const AVAILABLE_MODELS: readonly WllamaModelConfig[] = [
  {
    id: "Qwen2.5-3B-Instruct-Q4_K_M",
    displayName: "Qwen2.5 3B (Recommended)",
    sizeInMb: 1940,
    hfRepoId: "Qwen/Qwen2.5-3B-Instruct-GGUF",
    hfFilePath: "qwen2.5-3b-instruct-q4_k_m.gguf"
  },
  {
    id: "SmolLM2-1.7B-Instruct-Q4_K_M",
    displayName: "SmolLM2 1.7B (Faster)",
    sizeInMb: 1060,
    hfRepoId: "HuggingFaceTB/SmolLM2-1.7B-Instruct-GGUF",
    hfFilePath: "smollm2-1.7b-instruct-q4_k_m.gguf"
  },
  {
    id: "Phi-3.5-mini-instruct-Q4_K_M",
    displayName: "Phi-3.5 Mini 3.8B",
    sizeInMb: 2180,
    hfRepoId: "bartowski/Phi-3.5-mini-instruct-GGUF",
    hfFilePath: "Phi-3.5-mini-instruct-Q4_K_M.gguf"
  }
] as const

class WllamaProvider implements AiProviderInterface {
  private status: AiModelStatus = "idle"
  private progress = 0
  private error: string | null = null
  private engine: unknown = null
  private loadedModelId: string | null = null

  getStatus(): AiModelStatus {
    return this.status
  }

  getProgress(): number {
    return this.progress
  }

  getError(): string | null {
    return this.error
  }

  getAvailableModels(): readonly AiModelConfig[] {
    return AVAILABLE_MODELS
  }

  async loadModel(modelId: string): Promise<void> {
    if (this.status === "loading") {
      throw new Error("A model is already being loaded")
    }

    if (this.status === "ready" && this.loadedModelId === modelId) {
      return
    }

    if (this.status === "ready") {
      await this.unloadModel()
    }

    this.status = "loading"
    this.progress = 0
    this.error = null

    const modelConfig = AVAILABLE_MODELS.find(m => m.id === modelId)
    if (!modelConfig) {
      this.status = "error"
      this.error = `Unknown model: ${modelId}`
      throw new Error(this.error)
    }

    try {
      const { Wllama } = await import("@wllama/wllama")

      // Cast paths since WXT types browser.runtime.getURL with strict PublicPath
      const getURL = browser.runtime.getURL as (path: string) => string
      const wllama = new Wllama({
        "single-thread/wllama.wasm": getURL("/wasm/wllama-single.wasm"),
        "multi-thread/wllama.wasm": getURL("/wasm/wllama-multi.wasm")
      })

      await wllama.loadModelFromHF(modelConfig.hfRepoId, modelConfig.hfFilePath, {
        n_ctx: 2048,
        progressCallback: ({ loaded, total }) => {
          if (total > 0) {
            this.progress = Math.round((loaded / total) * 100)
          }
        }
      })

      this.engine = wllama
      this.loadedModelId = modelId
      this.status = "ready"
      this.progress = 100
    } catch (err) {
      this.status = "error"
      this.error = err instanceof Error ? err.message : "Failed to load model"
      this.engine = null
      this.loadedModelId = null
      throw err
    }
  }

  async unloadModel(): Promise<void> {
    if (this.engine) {
      try {
        const eng = this.engine as { exit?: () => Promise<void> }
        if (typeof eng.exit === "function") {
          await eng.exit()
        }
      } catch {
        // Ignore unload errors
      }
    }

    this.engine = null
    this.loadedModelId = null
    this.status = "idle"
    this.progress = 0
    this.error = null
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    if (this.status !== "ready" || !this.engine) {
      throw new Error("Model is not loaded")
    }

    const eng = this.engine as {
      createChatCompletion: (
        messages: Array<{ role: string; content: string }>,
        options: {
          nPredict?: number
          sampling?: { temp?: number }
        }
      ) => Promise<string>
    }

    const messages = request.messages.map(m => ({ role: m.role, content: m.content }))

    // If JSON output is requested, reinforce it in the system message
    if (request.responseFormat === "json") {
      const hasSystemMsg = messages.some(m => m.role === "system")
      if (hasSystemMsg) {
        const sysIdx = messages.findIndex(m => m.role === "system")
        messages[sysIdx].content +=
          "\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no explanation, no extra text."
      }
    }

    const content = await eng.createChatCompletion(messages, {
      nPredict: request.maxTokens ?? 512,
      sampling: {
        temp: request.temperature ?? 0.7
      }
    })

    return {
      content: content ?? "",
      finishReason: "stop"
    }
  }

  async isAvailable(): Promise<boolean> {
    return typeof WebAssembly !== "undefined"
  }
}

export const wllamaProvider = new WllamaProvider()
