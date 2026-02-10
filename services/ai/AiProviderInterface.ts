/**
 * Abstract interface that all AI provider backends must implement
 */

import type {
  AiCompletionRequest,
  AiCompletionResponse,
  AiModelConfig,
  AiModelStatus
} from "../../types"

export interface AiProviderInterface {
  /** Get the current model loading status */
  getStatus(): AiModelStatus

  /** Get the loading progress (0-100) */
  getProgress(): number

  /** Get the last error message, if any */
  getError(): string | null

  /** Get the list of available models for this provider */
  getAvailableModels(): readonly AiModelConfig[]

  /** Load a model by ID. Resolves when loading is complete. */
  loadModel(modelId: string): Promise<void>

  /** Unload the currently loaded model */
  unloadModel(): Promise<void>

  /** Run a chat completion against the loaded model */
  complete(request: AiCompletionRequest): Promise<AiCompletionResponse>

  /** Check if this provider is available in the current environment */
  isAvailable(): Promise<boolean>
}
