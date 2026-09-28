/**
 * OpenAI-compatible API provider implementation
 * Supports local inference servers (Ollama, LM Studio, vLLM, LocalAI) and remote APIs (OpenAI, Groq, DeepSeek, OpenRouter)
 */

import type {
  AiCompletionRequest,
  AiCompletionResponse,
  AiModelConfig,
  AiModelStatus,
  CustomAiModel,
  OpenAiCompatibleConfig
} from "../../types"
import type { AiProviderInterface } from "./AiProviderInterface"

export class OpenAiCompatibleProvider implements AiProviderInterface {
  private status: AiModelStatus = "idle"
  private progress = 0
  private error: string | null = null
  private loadedModelId: string | null = null
  private config: OpenAiCompatibleConfig = {
    baseUrl: "http://localhost:11434/v1",
    apiKey: "",
    modelName: ""
  }
  private customModels: CustomAiModel[] = []

  getStatus(): AiModelStatus {
    return this.status
  }

  getProgress(): number {
    return this.progress
  }

  getError(): string | null {
    return this.error
  }

  setConfig(config: Partial<OpenAiCompatibleConfig>): void {
    if (config.baseUrl !== undefined) {
      this.config.baseUrl = config.baseUrl.trim().replace(/\/+$/, "")
    }
    if (config.apiKey !== undefined) {
      this.config.apiKey = config.apiKey.trim()
    }
    if (config.modelName !== undefined) {
      this.config.modelName = config.modelName.trim()
    }
    if (config.customHeaders !== undefined) {
      this.config.customHeaders = { ...config.customHeaders }
    }
  }

  getConfig(): Readonly<OpenAiCompatibleConfig> {
    return { ...this.config }
  }

  setCustomModels(models: CustomAiModel[]): void {
    this.customModels = [...models]
  }

  getAvailableModels(): readonly AiModelConfig[] {
    const modelName = this.config.modelName || "default"
    const list: AiModelConfig[] = [
      {
        id: modelName,
        displayName: `${modelName} (Custom API)`,
        sizeInMb: 0,
        vramRequiredMb: 0
      }
    ]

    for (const custom of this.customModels) {
      if (!list.some(m => m.id === custom.id)) {
        list.push({
          id: custom.id,
          displayName: custom.displayName || custom.id,
          sizeInMb: custom.sizeInMb ?? 0,
          vramRequiredMb: custom.vramRequiredMb ?? 0
        })
      }
    }

    return list
  }

  async loadModel(modelId: string): Promise<void> {
    this.status = "loading"
    this.progress = 50
    this.error = null

    try {
      this.loadedModelId = modelId
      this.status = "ready"
      this.progress = 100
    } catch (err) {
      this.status = "error"
      this.error = err instanceof Error ? err.message : "Failed to load model"
      this.loadedModelId = null
      throw err
    }
  }

  async unloadModel(): Promise<void> {
    this.loadedModelId = null
    this.status = "idle"
    this.progress = 0
    this.error = null
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    const model =
      this.config.modelName ||
      (this.loadedModelId && this.loadedModelId !== "openai" && this.loadedModelId !== "default"
        ? this.loadedModelId
        : "gpt-4o-mini")
    const url = `${this.config.baseUrl}/chat/completions`

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(this.config.customHeaders ?? {})
    }

    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`
    }

    const body: Record<string, unknown> = {
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.3,
      max_tokens: request.maxTokens ?? 512
    }

    if (request.responseFormat === "json") {
      body.response_format = { type: "json_object" }
    }

    let response: Response
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      })
    } catch (err) {
      if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) {
        throw new Error(
          `Unable to connect to AI endpoint at ${this.config.baseUrl}. Please verify your server or URL is reachable.`
        )
      }
      throw err
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "")
      throw new Error(`API error ${response.status}: ${errText || response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content ?? ""
    const finishReason = data.choices?.[0]?.finish_reason ?? "stop"

    return { content, finishReason }
  }

  /**
   * Diagnostic connection test with latency measurement
   */
  async testConnection(configOverride?: Partial<OpenAiCompatibleConfig>): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    const baseUrl = (configOverride?.baseUrl ?? this.config.baseUrl ?? "").trim().replace(/\/+$/, "")
    const apiKey = (configOverride?.apiKey ?? this.config.apiKey ?? "").trim()
    const model = (configOverride?.modelName ?? this.config.modelName ?? "default").trim()

    const url = `${baseUrl}/chat/completions`
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    }
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`
    }

    const startTime = Date.now()
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 5
        })
      })

      const latencyMs = Date.now() - startTime
      if (!response.ok) {
        const errText = await response.text().catch(() => "")
        return {
          success: false,
          latencyMs,
          error: `HTTP ${response.status}: ${errText || response.statusText}`
        }
      }

      return { success: true, latencyMs }
    } catch (err) {
      const latencyMs = Date.now() - startTime
      const msg = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        latencyMs,
        error: `Connection failed: ${msg}`
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    return true
  }
}

export const openAiCompatibleProvider = new OpenAiCompatibleProvider()
