import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AiProviderInterface } from "../services/ai/AiProviderInterface"
import type {
  AiCompletionRequest,
  AiCompletionResponse,
  AiModelConfig,
  AiModelStatus
} from "../types"

// Hoist mock functions so they're available when vi.mock factories execute
const { mockProvider, mockSetAiEnabled, mockSetAiProvider, mockSetAiModelId } = vi.hoisted(() => {
  const mockSetAiEnabled = vi.fn().mockResolvedValue(undefined)
  const mockSetAiProvider = vi.fn().mockResolvedValue(undefined)
  const mockSetAiModelId = vi.fn().mockResolvedValue(undefined)

  const mockProvider: AiProviderInterface = {
    getStatus: vi.fn().mockReturnValue("idle" as AiModelStatus),
    getProgress: vi.fn().mockReturnValue(0),
    getError: vi.fn().mockReturnValue(null),
    getAvailableModels: vi
      .fn()
      .mockReturnValue([
        { id: "test-model", displayName: "Test Model", sizeInMb: 100, vramRequiredMb: 256 }
      ] as readonly AiModelConfig[]),
    loadModel: vi.fn().mockResolvedValue(undefined),
    unloadModel: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue({
      content: "test response",
      finishReason: "stop"
    } as AiCompletionResponse),
    isAvailable: vi.fn().mockResolvedValue(true)
  }

  return { mockProvider, mockSetAiEnabled, mockSetAiProvider, mockSetAiModelId }
})

// Mock all dependencies before importing AiService
vi.mock("../utils/storage", () => ({
  aiEnabled: { setValue: mockSetAiEnabled, getValue: vi.fn() },
  aiProvider: { setValue: mockSetAiProvider, getValue: vi.fn() },
  aiModelId: { setValue: mockSetAiModelId, getValue: vi.fn() }
}))

vi.mock("../utils/WebGpuUtils", () => ({
  checkWebGpuCapability: vi.fn().mockResolvedValue({ available: true, reason: null })
}))

vi.mock("../services/ai/WebLlmProvider", () => ({
  webLlmProvider: mockProvider
}))

// Import the singleton after all mocks are set up
import { aiService } from "../services/ai/AiService"

describe("AiService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to defaults
    aiService.updateFromStorage({
      aiEnabled: false,
      aiProvider: "webllm",
      aiModelId: "SmolLM2-360M-Instruct-q4f16_1-MLC",
      aiExternalApiKey: "",
      aiExternalApiEndpoint: ""
    })
  })

  describe("settings management", () => {
    it("should initialize with default values", () => {
      expect(aiService.isEnabled()).toBe(false)
      expect(aiService.getSelectedProvider()).toBe("webllm")
      expect(aiService.getSelectedModelId()).toBe("SmolLM2-360M-Instruct-q4f16_1-MLC")
    })

    it("should update from storage settings", () => {
      aiService.updateFromStorage({
        aiEnabled: true,
        aiProvider: "external",
        aiModelId: "test-model",
        aiExternalApiKey: "key123",
        aiExternalApiEndpoint: "https://api.example.com"
      })

      expect(aiService.isEnabled()).toBe(true)
      expect(aiService.getSelectedProvider()).toBe("external")
      expect(aiService.getSelectedModelId()).toBe("test-model")
    })

    it("should partially update from storage settings", () => {
      aiService.updateFromStorage({ aiEnabled: true })
      expect(aiService.isEnabled()).toBe(true)
      expect(aiService.getSelectedProvider()).toBe("webllm")
    })

    it("should set enabled and persist to storage", async () => {
      await aiService.setEnabled(true)
      expect(aiService.isEnabled()).toBe(true)
      expect(mockSetAiEnabled).toHaveBeenCalledWith(true)
    })

    it("should set provider and persist to storage", async () => {
      await aiService.setProvider("external")
      expect(aiService.getSelectedProvider()).toBe("external")
      expect(mockSetAiProvider).toHaveBeenCalledWith("external")
    })

    it("should set model ID and persist to storage", async () => {
      await aiService.setModelId("new-model")
      expect(aiService.getSelectedModelId()).toBe("new-model")
      expect(mockSetAiModelId).toHaveBeenCalledWith("new-model")
    })

    it("should return full settings object", () => {
      aiService.updateFromStorage({
        aiEnabled: true,
        aiProvider: "webllm",
        aiModelId: "test-model",
        aiExternalApiKey: "key",
        aiExternalApiEndpoint: "endpoint"
      })

      const settings = aiService.getSettings()
      expect(settings).toEqual({
        aiEnabled: true,
        aiProvider: "webllm",
        aiModelId: "test-model",
        aiExternalApiKey: "key",
        aiExternalApiEndpoint: "endpoint"
      })
    })
  })

  describe("model status", () => {
    it("should return model status from active provider", () => {
      const status = aiService.getModelStatus()
      expect(status).toEqual({
        status: "idle",
        progress: 0,
        modelId: expect.any(String),
        error: null
      })
    })
  })

  describe("model operations", () => {
    it("should delegate loadModel to the active provider", async () => {
      await aiService.loadModel()
      expect(mockProvider.loadModel).toHaveBeenCalled()
    })

    it("should delegate unloadModel to the active provider", async () => {
      await aiService.unloadModel()
      expect(mockProvider.unloadModel).toHaveBeenCalled()
    })

    it("should delegate complete to the active provider when enabled", async () => {
      aiService.updateFromStorage({ aiEnabled: true })
      const request: AiCompletionRequest = {
        messages: [{ role: "user", content: "hello" }]
      }
      const result = await aiService.complete(request)
      expect(result.content).toBe("test response")
      expect(mockProvider.complete).toHaveBeenCalledWith(request)
    })

    it("should throw when completing with AI disabled", async () => {
      aiService.updateFromStorage({ aiEnabled: false })
      const request: AiCompletionRequest = {
        messages: [{ role: "user", content: "hello" }]
      }
      await expect(aiService.complete(request)).rejects.toThrow("AI features are disabled")
    })
  })

  describe("available models", () => {
    it("should return available models from provider", () => {
      const models = aiService.getAvailableModels()
      expect(models).toHaveLength(1)
      expect(models[0].id).toBe("test-model")
    })
  })

  describe("WebGPU support", () => {
    it("should check WebGPU capability", async () => {
      const result = await aiService.checkWebGpuSupport()
      expect(result).toEqual({ available: true, reason: null })
    })
  })
})
