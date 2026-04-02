import { beforeEach, describe, expect, it, vi } from "vitest"

// Hoist mock engine so it's available in vi.mock factory
const { mockWllama, mockWllamaClass } = vi.hoisted(() => {
  const mockWllama = {
    loadModelFromHF: vi.fn().mockResolvedValue(undefined),
    createChatCompletion: vi.fn().mockResolvedValue("Hello from wllama AI"),
    exit: vi.fn().mockResolvedValue(undefined)
  }

  const mockWllamaClass = vi.fn().mockImplementation(() => mockWllama)

  return { mockWllama, mockWllamaClass }
})

vi.mock("@wllama/wllama", () => ({
  Wllama: mockWllamaClass
}))

// Mock browser.runtime.getURL
const mockGetURL = vi.fn((path: string) => `moz-extension://test-id${path}`)
vi.stubGlobal("browser", {
  runtime: {
    getURL: mockGetURL
  }
})

import { wllamaProvider } from "../services/ai/WllamaProvider"

describe("WllamaProvider", () => {
  beforeEach(async () => {
    // Reset provider state first, then clear mock call history
    await wllamaProvider.unloadModel()
    vi.clearAllMocks()
  })

  describe("initial state", () => {
    it("should start with idle status", () => {
      expect(wllamaProvider.getStatus()).toBe("idle")
    })

    it("should start with zero progress", () => {
      expect(wllamaProvider.getProgress()).toBe(0)
    })

    it("should start with no error", () => {
      expect(wllamaProvider.getError()).toBeNull()
    })
  })

  describe("getAvailableModels", () => {
    it("should return 3 available models", () => {
      const models = wllamaProvider.getAvailableModels()
      expect(models).toHaveLength(3)
    })

    it("should include Qwen2.5 3B as first model (recommended)", () => {
      const models = wllamaProvider.getAvailableModels()
      expect(models[0].id).toBe("Qwen2.5-3B-Instruct-Q4_K_M")
      expect(models[0].displayName).toContain("Recommended")
    })

    it("should have valid size information for all models", () => {
      const models = wllamaProvider.getAvailableModels()
      for (const model of models) {
        expect(model.sizeInMb).toBeGreaterThan(0)
      }
    })

    it("should not require vramRequiredMb (CPU-only provider)", () => {
      const models = wllamaProvider.getAvailableModels()
      for (const model of models) {
        expect(model.vramRequiredMb).toBeUndefined()
      }
    })
  })

  describe("loadModel", () => {
    it("should transition to ready status on success", async () => {
      await wllamaProvider.loadModel("Qwen2.5-3B-Instruct-Q4_K_M")
      expect(wllamaProvider.getStatus()).toBe("ready")
      expect(wllamaProvider.getProgress()).toBe(100)
      expect(wllamaProvider.getError()).toBeNull()
    })

    it("should create Wllama instance with correct WASM paths", async () => {
      await wllamaProvider.loadModel("Qwen2.5-3B-Instruct-Q4_K_M")
      expect(mockWllamaClass).toHaveBeenCalledWith({
        "single-thread/wllama.wasm": "moz-extension://test-id/wasm/wllama-single.wasm",
        "multi-thread/wllama.wasm": "moz-extension://test-id/wasm/wllama-multi.wasm"
      })
    })

    it("should call loadModelFromHF with correct model config", async () => {
      await wllamaProvider.loadModel("Qwen2.5-3B-Instruct-Q4_K_M")
      expect(mockWllama.loadModelFromHF).toHaveBeenCalledWith(
        "Qwen/Qwen2.5-3B-Instruct-GGUF",
        "qwen2.5-3b-instruct-q4_k_m.gguf",
        expect.objectContaining({
          n_ctx: 2048,
          progressCallback: expect.any(Function)
        })
      )
    })

    it("should provide progress callback", async () => {
      mockWllama.loadModelFromHF.mockImplementationOnce(
        (
          _repoId: string,
          _filePath: string,
          opts: { progressCallback: (data: { loaded: number; total: number }) => void }
        ) => {
          opts.progressCallback({ loaded: 250, total: 1000 })
          opts.progressCallback({ loaded: 500, total: 1000 })
          opts.progressCallback({ loaded: 750, total: 1000 })
          return Promise.resolve()
        }
      )

      await wllamaProvider.loadModel("Qwen2.5-3B-Instruct-Q4_K_M")
      // After completion, progress should be 100
      expect(wllamaProvider.getProgress()).toBe(100)
    })

    it("should transition to error status on failure", async () => {
      mockWllama.loadModelFromHF.mockRejectedValueOnce(new Error("Download failed"))

      await expect(wllamaProvider.loadModel("Qwen2.5-3B-Instruct-Q4_K_M")).rejects.toThrow(
        "Download failed"
      )
      expect(wllamaProvider.getStatus()).toBe("error")
      expect(wllamaProvider.getError()).toBe("Download failed")
    })

    it("should set error for unknown model ID", async () => {
      await expect(wllamaProvider.loadModel("nonexistent-model")).rejects.toThrow(
        "Unknown model: nonexistent-model"
      )
      expect(wllamaProvider.getStatus()).toBe("error")
    })

    it("should skip loading if same model is already ready", async () => {
      await wllamaProvider.loadModel("Qwen2.5-3B-Instruct-Q4_K_M")
      expect(mockWllamaClass).toHaveBeenCalledTimes(1)

      await wllamaProvider.loadModel("Qwen2.5-3B-Instruct-Q4_K_M")
      expect(mockWllamaClass).toHaveBeenCalledTimes(1)
    })

    it("should unload current model before loading a different one", async () => {
      await wllamaProvider.loadModel("Qwen2.5-3B-Instruct-Q4_K_M")
      expect(mockWllama.exit).not.toHaveBeenCalled()

      await wllamaProvider.loadModel("SmolLM2-1.7B-Instruct-Q4_K_M")
      expect(mockWllama.exit).toHaveBeenCalled()
    })

    it("should throw when a model is already loading", async () => {
      let resolveDeferred: () => void
      const deferred = new Promise<void>(resolve => {
        resolveDeferred = resolve
      })
      mockWllama.loadModelFromHF.mockReturnValueOnce(deferred)
      const loadPromise = wllamaProvider.loadModel("Qwen2.5-3B-Instruct-Q4_K_M")

      await expect(wllamaProvider.loadModel("SmolLM2-1.7B-Instruct-Q4_K_M")).rejects.toThrow(
        "A model is already being loaded"
      )

      // Resolve the deferred and clean up
      resolveDeferred!()
      await loadPromise
      await wllamaProvider.unloadModel()
    })
  })

  describe("unloadModel", () => {
    it("should reset state to idle", async () => {
      await wllamaProvider.loadModel("Qwen2.5-3B-Instruct-Q4_K_M")
      await wllamaProvider.unloadModel()

      expect(wllamaProvider.getStatus()).toBe("idle")
      expect(wllamaProvider.getProgress()).toBe(0)
      expect(wllamaProvider.getError()).toBeNull()
    })

    it("should call engine.exit when engine exists", async () => {
      await wllamaProvider.loadModel("Qwen2.5-3B-Instruct-Q4_K_M")
      await wllamaProvider.unloadModel()

      expect(mockWllama.exit).toHaveBeenCalled()
    })

    it("should handle unload when no engine is loaded", async () => {
      await expect(wllamaProvider.unloadModel()).resolves.toBeUndefined()
    })

    it("should handle engine.exit errors gracefully", async () => {
      mockWllama.exit.mockRejectedValueOnce(new Error("exit failed"))
      await wllamaProvider.loadModel("Qwen2.5-3B-Instruct-Q4_K_M")

      await expect(wllamaProvider.unloadModel()).resolves.toBeUndefined()
      expect(wllamaProvider.getStatus()).toBe("idle")
    })
  })

  describe("complete", () => {
    it("should return completion response when model is ready", async () => {
      await wllamaProvider.loadModel("Qwen2.5-3B-Instruct-Q4_K_M")
      const result = await wllamaProvider.complete({
        messages: [{ role: "user", content: "Hello" }]
      })
      expect(result.content).toBe("Hello from wllama AI")
      expect(result.finishReason).toBe("stop")
    })

    it("should pass messages to createChatCompletion", async () => {
      await wllamaProvider.loadModel("Qwen2.5-3B-Instruct-Q4_K_M")
      await wllamaProvider.complete({
        messages: [
          { role: "system", content: "You are helpful" },
          { role: "user", content: "Hi" }
        ]
      })

      expect(mockWllama.createChatCompletion).toHaveBeenCalledWith(
        [
          { role: "system", content: "You are helpful" },
          { role: "user", content: "Hi" }
        ],
        expect.objectContaining({
          nPredict: 512,
          sampling: { temp: 0.7 }
        })
      )
    })

    it("should use custom temperature and maxTokens when provided", async () => {
      await wllamaProvider.loadModel("Qwen2.5-3B-Instruct-Q4_K_M")
      await wllamaProvider.complete({
        messages: [{ role: "user", content: "test" }],
        temperature: 0.2,
        maxTokens: 256
      })

      expect(mockWllama.createChatCompletion).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          nPredict: 256,
          sampling: { temp: 0.2 }
        })
      )
    })

    it("should append JSON instruction to system message when responseFormat is json", async () => {
      await wllamaProvider.loadModel("Qwen2.5-3B-Instruct-Q4_K_M")
      await wllamaProvider.complete({
        messages: [
          { role: "system", content: "You are a helper." },
          { role: "user", content: "test" }
        ],
        responseFormat: "json"
      })

      const calledMessages = mockWllama.createChatCompletion.mock.calls[0][0]
      expect(calledMessages[0].content).toContain("You are a helper.")
      expect(calledMessages[0].content).toContain("valid JSON only")
    })

    it("should throw when model is not loaded", async () => {
      await expect(
        wllamaProvider.complete({
          messages: [{ role: "user", content: "test" }]
        })
      ).rejects.toThrow("Model is not loaded")
    })

    it("should handle empty response gracefully", async () => {
      mockWllama.createChatCompletion.mockResolvedValueOnce("")
      await wllamaProvider.loadModel("Qwen2.5-3B-Instruct-Q4_K_M")

      const result = await wllamaProvider.complete({
        messages: [{ role: "user", content: "test" }]
      })
      expect(result.content).toBe("")
      expect(result.finishReason).toBe("stop")
    })
  })

  describe("isAvailable", () => {
    it("should return true when WebAssembly is available", async () => {
      const result = await wllamaProvider.isAvailable()
      expect(result).toBe(true)
    })
  })
})
