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
  CustomAiModel,
  WebGpuCapability
} from "../../types"
import {
  aiCustomApiKey as aiCustomApiKeyStorage,
  aiCustomEndpoint as aiCustomEndpointStorage,
  aiCustomModel as aiCustomModelStorage,
  aiEnabled as aiEnabledStorage,
  aiModelId as aiModelIdStorage,
  aiProvider as aiProviderStorage,
  aiSimilarityThreshold as aiSimilarityThresholdStorage,
  customAiModels as customAiModelsStorage
} from "../../utils/storage"
import { checkWebGpuCapability } from "../../utils/WebGpuUtils"
import type { AiProviderInterface } from "./AiProviderInterface"
import { externalAiProvider } from "./ExternalAiProvider"
import { openAiCompatibleProvider } from "./OpenAiCompatibleProvider"
import { webLlmProvider } from "./WebLlmProvider"

class AiService {
  private enabled = false
  private provider: AiProvider = "webllm"
  private modelId = "Qwen2.5-3B-Instruct-q4f16_1-MLC"
  private customModels: CustomAiModel[] = []
  private similarityThreshold = 0.6

  private customEndpoint = "http://localhost:11434/v1"
  private customApiKey = ""
  private customModel = ""

  updateFromStorage(settings: Partial<AiStorageSettings>): void {
    if (settings.aiEnabled !== undefined) this.enabled = settings.aiEnabled
    if (settings.aiProvider !== undefined) this.provider = settings.aiProvider
    if (settings.customAiModels !== undefined) {
      this.customModels = [...settings.customAiModels]
      externalAiProvider.setCustomModels(this.customModels)
      openAiCompatibleProvider.setCustomModels(this.customModels)
    }
    if (settings.aiSimilarityThreshold !== undefined) {
      this.similarityThreshold = settings.aiSimilarityThreshold
    }
    if (settings.aiCustomEndpoint !== undefined) {
      this.customEndpoint = settings.aiCustomEndpoint
      openAiCompatibleProvider.setConfig({ baseUrl: this.customEndpoint })
      externalAiProvider.setEndpoint(this.customEndpoint)
    }
    if (settings.aiCustomApiKey !== undefined) {
      this.customApiKey = settings.aiCustomApiKey
      openAiCompatibleProvider.setConfig({ apiKey: this.customApiKey })
      externalAiProvider.setApiKey(this.customApiKey)
    }
    if (settings.aiCustomModel !== undefined) {
      this.customModel = settings.aiCustomModel
      openAiCompatibleProvider.setConfig({ modelName: this.customModel })
      externalAiProvider.setModelName(this.customModel)
    }
    if (settings.aiModelId !== undefined) {
      const available = this.getActiveProvider().getAvailableModels()
      const isValid = available.some(m => m.id === settings.aiModelId)
      this.modelId = isValid ? settings.aiModelId : (available[0]?.id ?? settings.aiModelId)
      if (!isValid && available.length > 0) {
        aiModelIdStorage.setValue(this.modelId)
      }
    }
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
    const available = this.getActiveProvider().getAvailableModels()
    if (!available.some(m => m.id === this.modelId) && available.length > 0) {
      this.modelId = available[0].id
      await aiModelIdStorage.setValue(this.modelId)
    }
  }

  getSelectedModelId(): string {
    return this.modelId
  }

  async setModelId(value: string): Promise<void> {
    this.modelId = value
    await aiModelIdStorage.setValue(value)
  }

  getSimilarityThreshold(): number {
    return this.similarityThreshold
  }

  async setSimilarityThreshold(value: number): Promise<void> {
    this.similarityThreshold = Math.max(0, Math.min(1, value))
    await aiSimilarityThresholdStorage.setValue(this.similarityThreshold)
  }

  getCustomModels(): readonly CustomAiModel[] {
    return this.customModels
  }

  async addCustomModel(model: CustomAiModel): Promise<void> {
    const existingIndex = this.customModels.findIndex(m => m.id === model.id)
    if (existingIndex >= 0) {
      this.customModels[existingIndex] = model
    } else {
      this.customModels.push(model)
    }
    externalAiProvider.setCustomModels(this.customModels)
    await customAiModelsStorage.setValue(this.customModels)
  }

  async removeCustomModel(modelId: string): Promise<void> {
    this.customModels = this.customModels.filter(m => m.id !== modelId)
    externalAiProvider.setCustomModels(this.customModels)
    await customAiModelsStorage.setValue(this.customModels)

    if (this.modelId === modelId) {
      const available = this.getAvailableModels()
      this.modelId = available[0]?.id || "Qwen2.5-3B-Instruct-q4f16_1-MLC"
      await aiModelIdStorage.setValue(this.modelId)
    }
  }

  getSettings(): AiStorageSettings {
    const s: AiStorageSettings = {
      aiEnabled: this.enabled,
      aiProvider: this.provider,
      aiModelId: this.modelId,
      aiCustomEndpoint: this.customEndpoint,
      aiCustomApiKey: this.customApiKey,
      aiCustomModel: this.customModel
    }
    if (this.customModels.length > 0) {
      s.customAiModels = this.customModels
    }
    return s
  }

  getCustomAiConfig(): { endpoint: string; apiKey: string; modelName: string } {
    return {
      endpoint: this.customEndpoint,
      apiKey: this.customApiKey,
      modelName: this.customModel
    }
  }

  async setCustomAiConfig(config: { endpoint?: string; apiKey?: string; modelName?: string }): Promise<void> {
    if (config.endpoint !== undefined) {
      this.customEndpoint = config.endpoint.trim().replace(/\/+$/, "")
      await aiCustomEndpointStorage.setValue(this.customEndpoint)
      openAiCompatibleProvider.setConfig({ baseUrl: this.customEndpoint })
      externalAiProvider.setEndpoint(this.customEndpoint)
    }
    if (config.apiKey !== undefined) {
      this.customApiKey = config.apiKey.trim()
      await aiCustomApiKeyStorage.setValue(this.customApiKey)
      openAiCompatibleProvider.setConfig({ apiKey: this.customApiKey })
      externalAiProvider.setApiKey(this.customApiKey)
    }
    if (config.modelName !== undefined) {
      this.customModel = config.modelName.trim()
      await aiCustomModelStorage.setValue(this.customModel)
      openAiCompatibleProvider.setConfig({ modelName: this.customModel })
      externalAiProvider.setModelName(this.customModel)
    }
  }

  async testConnection(configOverride?: { endpoint?: string; apiKey?: string; modelName?: string }): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    return openAiCompatibleProvider.testConnection({
      baseUrl: configOverride?.endpoint ?? this.customEndpoint,
      apiKey: configOverride?.apiKey ?? this.customApiKey,
      modelName: configOverride?.modelName ?? this.customModel
    })
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
    return openAiCompatibleProvider
  }
}

export const aiService = new AiService()
