/**
 * WebLLM provider implementation
 * Uses dynamic import to avoid loading the library until the user triggers it.
 * Chrome 124+ supports WebGPU in service workers.
 */

import type {
  AiCompletionRequest,
  AiCompletionResponse,
  AiModelConfig,
  AiModelStatus
} from "../../types"
import type { AiProviderInterface } from "./AiProviderInterface"

const AVAILABLE_MODELS: readonly AiModelConfig[] = [
  {
    id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    displayName: "Qwen2.5 0.5B (Recommended)",
    sizeInMb: 398,
    vramRequiredMb: 1024
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    displayName: "Llama 3.2 1B (Best Quality)",
    sizeInMb: 879,
    vramRequiredMb: 2048
  },
  {
    id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    displayName: "SmolLM2 360M (Fastest)",
    sizeInMb: 245,
    vramRequiredMb: 512
  }
] as const

class WebLlmProvider implements AiProviderInterface {
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

    try {
      const webllm = await import("@mlc-ai/web-llm")

      const engine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: (report: { progress: number; text: string }) => {
          this.progress = Math.round(report.progress * 100)
        }
      })

      this.engine = engine
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
        const eng = this.engine as { unload?: () => Promise<void> }
        if (typeof eng.unload === "function") {
          await eng.unload()
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
      chat: {
        completions: {
          create: (params: {
            messages: Array<{ role: string; content: string }>
            temperature?: number
            max_tokens?: number
          }) => Promise<{
            choices: Array<{
              message: { content: string }
              finish_reason: string
            }>
          }>
        }
      }
    }

    const response = await eng.chat.completions.create({
      messages: request.messages.map(m => ({ role: m.role, content: m.content })),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 512
    })

    const choice = response.choices[0]
    return {
      content: choice?.message?.content ?? "",
      finishReason: choice?.finish_reason ?? "unknown"
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (typeof navigator === "undefined") return false
      const gpu = (navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu
      if (!gpu) return false
      const adapter = await gpu.requestAdapter()
      return adapter !== null
    } catch {
      return false
    }
  }
}

export const webLlmProvider = new WebLlmProvider()
