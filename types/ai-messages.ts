/**
 * Type definitions for AI-related background script messages
 */

import type { AiModelStatusInfo, AiProvider, AiStorageSettings, WebGpuCapability } from "./ai"

/**
 * AI-specific message actions
 */
export type AiMessageAction =
  | "getAiState"
  | "setAiEnabled"
  | "setAiProvider"
  | "setAiModelId"
  | "getAiModelStatus"
  | "loadAiModel"
  | "unloadAiModel"
  | "checkWebGpuSupport"

/**
 * Get full AI state message
 */
export interface GetAiStateMessage {
  action: "getAiState"
}

/**
 * Set AI enabled message
 */
export interface SetAiEnabledMessage {
  action: "setAiEnabled"
  enabled: boolean
}

/**
 * Set AI provider message
 */
export interface SetAiProviderMessage {
  action: "setAiProvider"
  provider: AiProvider
}

/**
 * Set AI model ID message
 */
export interface SetAiModelIdMessage {
  action: "setAiModelId"
  modelId: string
}

/**
 * Get AI model status message
 */
export interface GetAiModelStatusMessage {
  action: "getAiModelStatus"
}

/**
 * Load AI model message
 */
export interface LoadAiModelMessage {
  action: "loadAiModel"
}

/**
 * Unload AI model message
 */
export interface UnloadAiModelMessage {
  action: "unloadAiModel"
}

/**
 * Check WebGPU support message
 */
export interface CheckWebGpuSupportMessage {
  action: "checkWebGpuSupport"
}

/**
 * Union of all AI messages
 */
export type AiMessage =
  | GetAiStateMessage
  | SetAiEnabledMessage
  | SetAiProviderMessage
  | SetAiModelIdMessage
  | GetAiModelStatusMessage
  | LoadAiModelMessage
  | UnloadAiModelMessage
  | CheckWebGpuSupportMessage

/**
 * Response for getAiState
 */
export interface AiStateResponse {
  settings: AiStorageSettings
  modelStatus: AiModelStatusInfo
}

/**
 * Response for setAiEnabled
 */
export interface SetAiEnabledResponse {
  enabled: boolean
}

/**
 * Response for setAiProvider
 */
export interface SetAiProviderResponse {
  provider: AiProvider
}

/**
 * Response for setAiModelId
 */
export interface SetAiModelIdResponse {
  modelId: string
}

/**
 * Response for getAiModelStatus
 */
export interface AiModelStatusResponse {
  modelStatus: AiModelStatusInfo
}

/**
 * Response for loadAiModel
 */
export interface LoadAiModelResponse {
  success: boolean
  error?: string
}

/**
 * Response for unloadAiModel
 */
export interface UnloadAiModelResponse {
  success: boolean
}

/**
 * Response for checkWebGpuSupport
 */
export interface WebGpuSupportResponse {
  webGpu: WebGpuCapability
}
