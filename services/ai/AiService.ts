/**
 * AI Service orchestrator
 * Manages settings, delegates to the active provider, and exposes status.
 */

import type {
  AiCompletionRequest,
  AiCompletionResponse,
  AiModelConfig,
  AiModelStatusInfo,
  AiProvider,
  AiStorageSettings,
  WebGpuCapability
} from "../../types"
import {
  aiEnabled as aiEnabledStorage,
  aiModelId as aiModelIdStorage,
  aiProvider as aiProviderStorage
} from "../../utils/storage"
import { checkWebGpuCapability } from "../../utils/WebGpuUtils"
import type { AiProviderInterface } from "./AiProviderInterface"
import { webLlmProvider } from "./WebLlmProvider"

class AiService {
  private enabled = false
  private provider: AiProvider = "webllm"
  private modelId = "SmolLM2-360M-Instruct-q4f16_1-MLC"
  private externalApiKey = ""
  private externalApiEndpoint = ""

  updateFromStorage(settings: Partial<AiStorageSettings>): void {
    if (settings.aiEnabled !== undefined) this.enabled = settings.aiEnabled
    if (settings.aiProvider !== undefined) this.provider = settings.aiProvider
    if (settings.aiModelId !== undefined) this.modelId = settings.aiModelId
    if (settings.aiExternalApiKey !== undefined) this.externalApiKey = settings.aiExternalApiKey
    if (settings.aiExternalApiEndpoint !== undefined)
      this.externalApiEndpoint = settings.aiExternalApiEndpoint
  }

  isEnabled(): boolean {
    return this.enabled
  }

  async setEnabled(value: boolean): Promise<void> {
    this.enabled = value
    await aiEnabledStorage.setValue(value)
  }

  getSelectedProvider(): AiProvider {
    return this.provider
  }

  async setProvider(value: AiProvider): Promise<void> {
    this.provider = value
    await aiProviderStorage.setValue(value)
  }

  getSelectedModelId(): string {
    return this.modelId
  }

  async setModelId(value: string): Promise<void> {
    this.modelId = value
    await aiModelIdStorage.setValue(value)
  }

  getSettings(): AiStorageSettings {
    return {
      aiEnabled: this.enabled,
      aiProvider: this.provider,
      aiModelId: this.modelId,
      aiExternalApiKey: this.externalApiKey,
      aiExternalApiEndpoint: this.externalApiEndpoint
    }
  }

  getAvailableModels(): readonly AiModelConfig[] {
    return this.getActiveProvider().getAvailableModels()
  }

  getModelStatus(): AiModelStatusInfo {
    const activeProvider = this.getActiveProvider()
    return {
      status: activeProvider.getStatus(),
      progress: activeProvider.getProgress(),
      modelId: this.modelId,
      error: activeProvider.getError()
    }
  }

  async loadModel(): Promise<void> {
    const activeProvider = this.getActiveProvider()
    await activeProvider.loadModel(this.modelId)
  }

  async unloadModel(): Promise<void> {
    const activeProvider = this.getActiveProvider()
    await activeProvider.unloadModel()
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    if (!this.enabled) {
      throw new Error("AI features are disabled")
    }
    const activeProvider = this.getActiveProvider()
    return activeProvider.complete(request)
  }

  async checkWebGpuSupport(): Promise<WebGpuCapability> {
    return checkWebGpuCapability()
  }

  private getActiveProvider(): AiProviderInterface {
    if (this.provider === "webllm") {
      return webLlmProvider
    }
    // Future: return externalProvider
    return webLlmProvider
  }
}

export const aiService = new AiService()
