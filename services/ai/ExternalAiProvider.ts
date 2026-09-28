/**
 * External / OpenAI-compatible API provider implementation
 * Supports local instances (Ollama, LM Studio, vLLM) and external APIs (OpenAI, Groq, etc.)
 */

import type {
  AiCompletionRequest,
  AiCompletionResponse,
  AiModelConfig,
  AiModelStatus,
  CustomAiModel
} from "../../types"
import type { AiProviderInterface } from "./AiProviderInterface"

const DEFAULT_EXTERNAL_MODELS: readonly AiModelConfig[] = [
  {
    id: "gpt-4o-mini",
    displayName: "GPT-4o Mini (Cloud API)",
    sizeInMb: 0,
    vramRequiredMb: 0
  },
  {
    id: "llama3.2:latest",
    displayName: "Llama 3.2 (Ollama / Local)",
    sizeInMb: 2000,
    vramRequiredMb: 2500
  },
  {
    id: "mistral:latest",
    displayName: "Mistral (Ollama / Local)",
    sizeInMb: 4100,
    vramRequiredMb: 4500
  },
  {
    id: "qwen2.5:latest",
    displayName: "Qwen 2.5 (Ollama / Local)",
    sizeInMb: 2500,
    vramRequiredMb: 3000
  }
] as const

export class ExternalAiProvider implements AiProviderInterface {
  private status: AiModelStatus = "idle"
  private progress = 0
  private error: string | null = null
  private loadedModelId: string | null = null
  private endpoint = "http://localhost:11434/v1"
  private apiKey = ""
  private modelName = ""
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

  setEndpoint(endpoint: string): void {
    this.endpoint = endpoint.trim().replace(/\/+$/, "")
  }

  getEndpoint(): string {
    return this.endpoint
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey.trim()
  }

  setModelName(modelName: string): void {
    this.modelName = modelName.trim()
  }

  setCustomModels(models: CustomAiModel[]): void {
    this.customModels = [...models]
  }

  resolveModelConfig(modelId: string): { endpoint: string; apiKey: string } {
    const custom = this.customModels.find(m => m.id === modelId)
    const endpoint = (custom?.endpoint?.trim() || this.endpoint).replace(/\/+$/, "")
    const apiKey = custom?.apiKey?.trim() || this.apiKey
    return { endpoint, apiKey }
  }

  getAvailableModels(): readonly AiModelConfig[] {
    const customConfigs: AiModelConfig[] = this.customModels.map(m => ({
      id: m.id,
      displayName: m.displayName || m.id,
      sizeInMb: m.sizeInMb ?? 0,
      vramRequiredMb: m.vramRequiredMb ?? 0
    }))

    const all = [...DEFAULT_EXTERNAL_MODELS]
    for (const custom of customConfigs) {
      if (!all.some(m => m.id === custom.id)) {
        all.push(custom)
      }
    }
    return all
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
      this.error = err instanceof Error ? err.message : "Failed to connect to external provider"
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
    const model = this.modelName || this.loadedModelId || "gpt-4o-mini"
    const { endpoint, apiKey } = this.resolveModelConfig(model)
    const url = `${endpoint}/chat/completions`

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    }

    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`
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
          `Unable to connect to AI endpoint at ${endpoint}. Please verify your AI service is running.`
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

  async isAvailable(): Promise<boolean> {
    return true
  }
}

export const externalAiProvider = new ExternalAiProvider()
