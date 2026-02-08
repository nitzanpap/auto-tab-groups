/**
 * Type definitions for AI features
 */

import type { AiGroupSuggestion } from "./ai-messages"

/**
 * Supported AI provider backends
 */
export type AiProvider = "webllm" | "external"

/**
 * AI model loading state machine: idle → loading → ready (or error)
 */
export type AiModelStatus = "idle" | "loading" | "ready" | "error"

/**
 * Configuration for an available AI model
 */
export interface AiModelConfig {
  id: string
  displayName: string
  sizeInMb: number
  vramRequiredMb: number
}

/**
 * Current status of the AI model including progress
 */
export interface AiModelStatusInfo {
  status: AiModelStatus
  progress: number
  modelId: string | null
  error: string | null
}

/**
 * OpenAI-compatible chat message format
 */
export interface AiChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

/**
 * Request to complete a chat prompt
 */
export interface AiCompletionRequest {
  messages: AiChatMessage[]
  temperature?: number
  maxTokens?: number
  /** When set, forces the model to produce valid JSON at the decoding level */
  responseFormat?: "json"
  /** JSON Schema string — enforces exact structure at the grammar level */
  responseSchema?: string
}

/**
 * Response from a chat completion
 */
export interface AiCompletionResponse {
  content: string
  finishReason: string
}

/**
 * WebGPU capability detection result
 */
export interface WebGpuCapability {
  available: boolean
  reason: string | null
}

/**
 * AI settings stored in browser storage
 */
export interface AiStorageSettings {
  aiEnabled: boolean
  aiProvider: AiProvider
  aiModelId: string
}

/**
 * Cached AI group suggestions (persisted across popup reopens)
 */
export interface CachedAiSuggestions {
  suggestions: AiGroupSuggestion[]
  appliedIndices: number[]
  timestamp: number
}
