import { beforeEach, describe, expect, it, vi } from "vitest"

// Hoist mock engine so it's available in vi.mock factory
const { mockEngine, mockCreateMLCEngine } = vi.hoisted(() => {
  const mockEngine = {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: { content: "Hello from AI" },
              finish_reason: "stop"
            }
          ]
        })
      }
    },
    unload: vi.fn().mockResolvedValue(undefined)
  }

  const mockCreateMLCEngine = vi.fn().mockResolvedValue(mockEngine)

  return { mockEngine, mockCreateMLCEngine }
})

vi.mock("@mlc-ai/web-llm", () => ({
  CreateMLCEngine: mockCreateMLCEngine
}))

import { webLlmProvider } from "../services/ai/WebLlmProvider"

describe("WebLlmProvider", () => {
  beforeEach(async () => {
    // Reset provider state first, then clear mock call history
    await webLlmProvider.unloadModel()
    vi.clearAllMocks()
  })

  describe("initial state", () => {
    it("should start with idle status", () => {
      expect(webLlmProvider.getStatus()).toBe("idle")
    })

    it("should start with zero progress", () => {
      expect(webLlmProvider.getProgress()).toBe(0)
    })

    it("should start with no error", () => {
      expect(webLlmProvider.getError()).toBeNull()
    })
  })

  describe("getAvailableModels", () => {
    it("should return 3 available models", () => {
      const models = webLlmProvider.getAvailableModels()
      expect(models).toHaveLength(3)
    })

    it("should include Qwen2.5 as first model (recommended)", () => {
      const models = webLlmProvider.getAvailableModels()
      expect(models[0].id).toBe("Qwen2.5-0.5B-Instruct-q4f16_1-MLC")
      expect(models[0].displayName).toContain("Recommended")
    })

    it("should include SmolLM2 model", () => {
      const models = webLlmProvider.getAvailableModels()
      expect(models[1].id).toBe("SmolLM2-360M-Instruct-q4f16_1-MLC")
    })

    it("should include Llama 3.2 model", () => {
      const models = webLlmProvider.getAvailableModels()
      expect(models[2].id).toBe("Llama-3.2-1B-Instruct-q4f16_1-MLC")
    })

    it("should have valid size information for all models", () => {
      const models = webLlmProvider.getAvailableModels()
      for (const model of models) {
        expect(model.sizeInMb).toBeGreaterThan(0)
        expect(model.vramRequiredMb).toBeGreaterThan(0)
        expect(model.vramRequiredMb).toBeGreaterThanOrEqual(model.sizeInMb)
      }
    })
  })

  describe("loadModel", () => {
    it("should transition to ready status on success", async () => {
      await webLlmProvider.loadModel("SmolLM2-360M-Instruct-q4f16_1-MLC")
      expect(webLlmProvider.getStatus()).toBe("ready")
      expect(webLlmProvider.getProgress()).toBe(100)
      expect(webLlmProvider.getError()).toBeNull()
    })

    it("should call CreateMLCEngine with correct model ID", async () => {
      await webLlmProvider.loadModel("test-model-id")
      expect(mockCreateMLCEngine).toHaveBeenCalledWith(
        "test-model-id",
        expect.objectContaining({
          initProgressCallback: expect.any(Function)
        })
      )
    })

    it("should provide progress callback to engine", async () => {
      mockCreateMLCEngine.mockImplementationOnce(
        (
          _modelId: string,
          opts: { initProgressCallback: (report: { progress: number; text: string }) => void }
        ) => {
          // Simulate progress updates
          opts.initProgressCallback({ progress: 0.25, text: "Loading..." })
          opts.initProgressCallback({ progress: 0.5, text: "Loading..." })
          opts.initProgressCallback({ progress: 0.75, text: "Loading..." })
          return Promise.resolve(mockEngine)
        }
      )

      await webLlmProvider.loadModel("test-model")
      // After completion, progress should be 100
      expect(webLlmProvider.getProgress()).toBe(100)
    })

    it("should transition to error status on failure", async () => {
      mockCreateMLCEngine.mockRejectedValueOnce(new Error("GPU initialization failed"))

      await expect(webLlmProvider.loadModel("bad-model")).rejects.toThrow(
        "GPU initialization failed"
      )
      expect(webLlmProvider.getStatus()).toBe("error")
      expect(webLlmProvider.getError()).toBe("GPU initialization failed")
    })

    it("should set generic error for non-Error throws", async () => {
      mockCreateMLCEngine.mockRejectedValueOnce("string error")

      await expect(webLlmProvider.loadModel("bad-model")).rejects.toBe("string error")
      expect(webLlmProvider.getStatus()).toBe("error")
      expect(webLlmProvider.getError()).toBe("Failed to load model")
    })

    it("should skip loading if same model is already ready", async () => {
      await webLlmProvider.loadModel("test-model")
      expect(mockCreateMLCEngine).toHaveBeenCalledTimes(1)

      await webLlmProvider.loadModel("test-model")
      expect(mockCreateMLCEngine).toHaveBeenCalledTimes(1)
    })

    it("should unload current model before loading a different one", async () => {
      await webLlmProvider.loadModel("model-1")
      expect(mockEngine.unload).not.toHaveBeenCalled()

      await webLlmProvider.loadModel("model-2")
      expect(mockEngine.unload).toHaveBeenCalled()
    })

    it("should throw when a model is already loading", async () => {
      // Use a controllable deferred promise instead of new Promise(() => {})
      // to avoid corrupting vi.mock for dynamic import() in subsequent tests
      let resolveDeferred: (value: unknown) => void
      const deferred = new Promise(resolve => {
        resolveDeferred = resolve
      })
      mockCreateMLCEngine.mockReturnValueOnce(deferred)
      const loadPromise = webLlmProvider.loadModel("model-1")

      await expect(webLlmProvider.loadModel("model-2")).rejects.toThrow(
        "A model is already being loaded"
      )

      // Resolve the deferred and clean up
      resolveDeferred!(mockEngine)
      await loadPromise
      await webLlmProvider.unloadModel()
    })
  })

  describe("unloadModel", () => {
    it("should reset state to idle", async () => {
      await webLlmProvider.loadModel("test-model")
      await webLlmProvider.unloadModel()

      expect(webLlmProvider.getStatus()).toBe("idle")
      expect(webLlmProvider.getProgress()).toBe(0)
      expect(webLlmProvider.getError()).toBeNull()
    })

    it("should call engine.unload when engine exists", async () => {
      await webLlmProvider.loadModel("test-model")
      await webLlmProvider.unloadModel()

      expect(mockEngine.unload).toHaveBeenCalled()
    })

    it("should handle unload when no engine is loaded", async () => {
      // Should not throw
      await expect(webLlmProvider.unloadModel()).resolves.toBeUndefined()
    })

    it("should handle engine.unload errors gracefully", async () => {
      mockEngine.unload.mockRejectedValueOnce(new Error("unload failed"))
      await webLlmProvider.loadModel("test-model")

      // Should not throw even if engine.unload fails
      await expect(webLlmProvider.unloadModel()).resolves.toBeUndefined()
      expect(webLlmProvider.getStatus()).toBe("idle")
    })

    it("should handle engine without unload method", async () => {
      const engineWithoutUnload = {
        chat: mockEngine.chat
      }
      mockCreateMLCEngine.mockResolvedValueOnce(engineWithoutUnload)

      await webLlmProvider.loadModel("test-model")
      // Should not throw
      await expect(webLlmProvider.unloadModel()).resolves.toBeUndefined()
    })
  })

  describe("complete", () => {
    it("should return completion response when model is ready", async () => {
      await webLlmProvider.loadModel("test-model")
      const result = await webLlmProvider.complete({
        messages: [{ role: "user", content: "Hello" }]
      })
      expect(result.content).toBe("Hello from AI")
      expect(result.finishReason).toBe("stop")
    })

    it("should pass messages to engine", async () => {
      await webLlmProvider.loadModel("test-model")
      await webLlmProvider.complete({
        messages: [
          { role: "system", content: "You are helpful" },
          { role: "user", content: "Hi" }
        ]
      })

      expect(mockEngine.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: "system", content: "You are helpful" },
            { role: "user", content: "Hi" }
          ]
        })
      )
    })

    it("should use default temperature and max_tokens", async () => {
      await webLlmProvider.loadModel("test-model")
      await webLlmProvider.complete({
        messages: [{ role: "user", content: "test" }]
      })

      expect(mockEngine.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
          max_tokens: 512
        })
      )
    })

    it("should use custom temperature and maxTokens when provided", async () => {
      await webLlmProvider.loadModel("test-model")
      await webLlmProvider.complete({
        messages: [{ role: "user", content: "test" }],
        temperature: 0.2,
        maxTokens: 256
      })

      expect(mockEngine.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.2,
          max_tokens: 256
        })
      )
    })

    it("should throw when model is not loaded", async () => {
      await expect(
        webLlmProvider.complete({
          messages: [{ role: "user", content: "test" }]
        })
      ).rejects.toThrow("Model is not loaded")
    })

    it("should handle empty choices array gracefully", async () => {
      mockEngine.chat.completions.create.mockResolvedValueOnce({
        choices: []
      })
      await webLlmProvider.loadModel("test-model")

      const result = await webLlmProvider.complete({
        messages: [{ role: "user", content: "test" }]
      })
      expect(result.content).toBe("")
      expect(result.finishReason).toBe("unknown")
    })
  })

  describe("isAvailable", () => {
    it("should return true when GPU adapter exists", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          userAgent: "test",
          gpu: { requestAdapter: vi.fn().mockResolvedValue({}) }
        },
        writable: true,
        configurable: true
      })

      const result = await webLlmProvider.isAvailable()
      expect(result).toBe(true)
    })

    it("should return false when GPU is not available", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: { userAgent: "test" },
        writable: true,
        configurable: true
      })

      const result = await webLlmProvider.isAvailable()
      expect(result).toBe(false)
    })

    it("should return false when adapter is null", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          userAgent: "test",
          gpu: { requestAdapter: vi.fn().mockResolvedValue(null) }
        },
        writable: true,
        configurable: true
      })

      const result = await webLlmProvider.isAvailable()
      expect(result).toBe(false)
    })

    it("should return false when requestAdapter throws", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          userAgent: "test",
          gpu: { requestAdapter: vi.fn().mockRejectedValue(new Error("error")) }
        },
        writable: true,
        configurable: true
      })

      const result = await webLlmProvider.isAvailable()
      expect(result).toBe(false)
    })
  })
})
