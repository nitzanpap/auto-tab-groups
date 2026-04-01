import type { MockInstance } from "vitest"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * NOTE: vi.mock module interception does not work under Bun's runtime.
 * These tests use vi.spyOn on the actual singleton instances instead.
 */

import { aiService } from "../services/ai/AiService"
import { webLlmProvider } from "../services/ai/WebLlmProvider"
import { aiEnabled, aiModelId, aiProvider } from "../utils/storage"
import * as WebGpuUtils from "../utils/WebGpuUtils"

const TEST_MODEL = {
  id: "test-model",
  displayName: "Test Model",
  sizeInMb: 100,
  vramRequiredMb: 256
} as const

describe("AiService", () => {
  // biome-ignore lint/suspicious/noExplicitAny: vi.spyOn returns heterogeneous mock types
  type Spy = MockInstance<(...args: any[]) => any>
  let spyGetAvailableModels: Spy
  let spyGetStatus: Spy
  let spyGetProgress: Spy
  let spyGetError: Spy
  let spyLoadModel: Spy
  let spyUnloadModel: Spy
  let spyComplete: Spy
  let spyIsAvailable: Spy
  let spySetAiEnabled: Spy
  let spySetAiProvider: Spy
  let spySetAiModelId: Spy

  beforeEach(() => {
    // Spy on the shared webLlmProvider singleton
    spyGetAvailableModels = vi
      .spyOn(webLlmProvider, "getAvailableModels")
      .mockReturnValue([TEST_MODEL])
    spyGetStatus = vi.spyOn(webLlmProvider, "getStatus").mockReturnValue("idle")
    spyGetProgress = vi.spyOn(webLlmProvider, "getProgress").mockReturnValue(0)
    spyGetError = vi.spyOn(webLlmProvider, "getError").mockReturnValue(null)
    spyLoadModel = vi.spyOn(webLlmProvider, "loadModel").mockResolvedValue(undefined)
    spyUnloadModel = vi.spyOn(webLlmProvider, "unloadModel").mockResolvedValue(undefined)
    spyComplete = vi.spyOn(webLlmProvider, "complete").mockResolvedValue({
      content: "test response",
      finishReason: "stop"
    })
    spyIsAvailable = vi.spyOn(webLlmProvider, "isAvailable").mockResolvedValue(true)

    // Spy on WXT storage items
    spySetAiEnabled = vi.spyOn(aiEnabled, "setValue").mockResolvedValue(undefined)
    spySetAiProvider = vi.spyOn(aiProvider, "setValue").mockResolvedValue(undefined)
    spySetAiModelId = vi.spyOn(aiModelId, "setValue").mockResolvedValue(undefined)

    // Reset to defaults (use "test-model" which matches mock's available models)
    aiService.updateFromStorage({
      aiEnabled: false,
      aiProvider: "webllm",
      aiModelId: "test-model"
    })

    // Clear call counts from the setup phase
    vi.clearAllMocks()

    // Re-apply spies after clearAllMocks (clearAllMocks resets mock implementations)
    spyGetAvailableModels.mockReturnValue([TEST_MODEL])
    spyGetStatus.mockReturnValue("idle")
    spyGetProgress.mockReturnValue(0)
    spyGetError.mockReturnValue(null)
    spyLoadModel.mockResolvedValue(undefined)
    spyUnloadModel.mockResolvedValue(undefined)
    spyComplete.mockResolvedValue({ content: "test response", finishReason: "stop" })
    spyIsAvailable.mockResolvedValue(true)
    spySetAiEnabled.mockResolvedValue(undefined)
    spySetAiProvider.mockResolvedValue(undefined)
    spySetAiModelId.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("settings management", () => {
    it("should initialize with default values", () => {
      expect(aiService.isEnabled()).toBe(false)
      expect(aiService.getSelectedProvider()).toBe("webllm")
      expect(aiService.getSelectedModelId()).toBe("test-model")
    })

    it("should update from storage settings", () => {
      aiService.updateFromStorage({
        aiEnabled: true,
        aiProvider: "external",
        aiModelId: "test-model"
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
      expect(spySetAiEnabled).toHaveBeenCalledWith(true)
    })

    it("should set provider and persist to storage", async () => {
      await aiService.setProvider("external")
      expect(aiService.getSelectedProvider()).toBe("external")
      expect(spySetAiProvider).toHaveBeenCalledWith("external")
    })

    it("should set model ID and persist to storage", async () => {
      await aiService.setModelId("new-model")
      expect(aiService.getSelectedModelId()).toBe("new-model")
      expect(spySetAiModelId).toHaveBeenCalledWith("new-model")
    })

    it("should return full settings object", () => {
      aiService.updateFromStorage({
        aiEnabled: true,
        aiProvider: "webllm",
        aiModelId: "test-model"
      })

      const settings = aiService.getSettings()
      expect(settings).toEqual({
        aiEnabled: true,
        aiProvider: "webllm",
        aiModelId: "test-model"
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
      expect(spyLoadModel).toHaveBeenCalled()
    })

    it("should delegate unloadModel to the active provider", async () => {
      await aiService.unloadModel()
      expect(spyUnloadModel).toHaveBeenCalled()
    })

    it("should delegate complete to the active provider when enabled", async () => {
      aiService.updateFromStorage({ aiEnabled: true })
      const request = {
        messages: [{ role: "user" as const, content: "hello" }]
      }
      const result = await aiService.complete(request)
      expect(result.content).toBe("test response")
      expect(spyComplete).toHaveBeenCalledWith(request)
    })

    it("should throw when completing with AI disabled", async () => {
      aiService.updateFromStorage({ aiEnabled: false })
      const request = {
        messages: [{ role: "user" as const, content: "hello" }]
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

  describe("external provider fallback", () => {
    it("should still delegate to webllm provider when set to external (future placeholder)", () => {
      aiService.updateFromStorage({ aiProvider: "external" })
      const status = aiService.getModelStatus()
      // The external provider fallback currently returns webLlmProvider
      expect(status.status).toBe("idle")
    })

    it("should delegate loadModel even with external provider", async () => {
      aiService.updateFromStorage({ aiProvider: "external" })
      await aiService.loadModel()
      expect(spyLoadModel).toHaveBeenCalled()
    })
  })

  describe("toggle operations", () => {
    it("should set enabled to false and persist", async () => {
      aiService.updateFromStorage({ aiEnabled: true })
      await aiService.setEnabled(false)
      expect(aiService.isEnabled()).toBe(false)
      expect(spySetAiEnabled).toHaveBeenCalledWith(false)
    })

    it("should switch provider back to webllm", async () => {
      aiService.updateFromStorage({ aiProvider: "external" })
      await aiService.setProvider("webllm")
      expect(aiService.getSelectedProvider()).toBe("webllm")
      expect(spySetAiProvider).toHaveBeenCalledWith("webllm")
    })
  })

  describe("model status with different provider states", () => {
    it("should reflect provider error state in model status", () => {
      spyGetStatus.mockReturnValueOnce("error")
      spyGetError.mockReturnValueOnce("Something broke")
      const status = aiService.getModelStatus()
      expect(status.status).toBe("error")
      expect(status.error).toBe("Something broke")
    })

    it("should reflect provider loading state in model status", () => {
      spyGetStatus.mockReturnValueOnce("loading")
      spyGetProgress.mockReturnValueOnce(42)
      const status = aiService.getModelStatus()
      expect(status.status).toBe("loading")
      expect(status.progress).toBe(42)
    })

    it("should reflect provider ready state in model status", () => {
      spyGetStatus.mockReturnValueOnce("ready")
      spyGetProgress.mockReturnValueOnce(100)
      const status = aiService.getModelStatus()
      expect(status.status).toBe("ready")
      expect(status.progress).toBe(100)
    })

    it("should include selected model ID in status", () => {
      aiService.updateFromStorage({ aiModelId: "test-model" })
      const status = aiService.getModelStatus()
      expect(status.modelId).toBe("test-model")
    })
  })

  describe("stale model ID migration", () => {
    it("should fall back to first available model when stored ID is invalid", () => {
      aiService.updateFromStorage({ aiModelId: "removed-model-id" })
      expect(aiService.getSelectedModelId()).toBe("test-model")
    })

    it("should persist corrected model ID to storage", () => {
      aiService.updateFromStorage({ aiModelId: "removed-model-id" })
      expect(spySetAiModelId).toHaveBeenCalledWith("test-model")
    })

    it("should not persist when stored ID is valid", () => {
      aiService.updateFromStorage({ aiModelId: "test-model" })
      expect(spySetAiModelId).not.toHaveBeenCalled()
    })
  })

  describe("WebGPU support", () => {
    it("should check WebGPU capability", async () => {
      vi.spyOn(WebGpuUtils, "checkWebGpuCapability").mockResolvedValue({
        available: true,
        reason: null
      })
      const result = await aiService.checkWebGpuSupport()
      expect(result).toEqual({ available: true, reason: null })
    })
  })
})
