import { beforeEach, describe, expect, it, vi } from "vitest"
import { OpenAiCompatibleProvider } from "../services/ai/OpenAiCompatibleProvider"

describe("OpenAiCompatibleProvider", () => {
  let provider: OpenAiCompatibleProvider

  beforeEach(() => {
    provider = new OpenAiCompatibleProvider()
    vi.restoreAllMocks()
  })

  it("should initialize with default config and idle status", () => {
    expect(provider.getStatus()).toBe("idle")
    expect(provider.getProgress()).toBe(0)
    expect(provider.getError()).toBeNull()
    const config = provider.getConfig()
    expect(config.baseUrl).toBe("http://localhost:11434/v1")
    expect(config.modelName).toBe("gpt-4o-mini")
  })

  it("should update configuration cleanly", () => {
    provider.setConfig({
      baseUrl: "https://api.openai.com/v1/",
      apiKey: "sk-test-123",
      modelName: "gpt-4o"
    })
    const config = provider.getConfig()
    expect(config.baseUrl).toBe("https://api.openai.com/v1")
    expect(config.apiKey).toBe("sk-test-123")
    expect(config.modelName).toBe("gpt-4o")
  })

  it("should return available models including configured and custom models", () => {
    provider.setConfig({ modelName: "deepseek-chat" })
    provider.setCustomModels([
      {
        id: "llama3.2:latest",
        displayName: "Llama 3.2",
        provider: "external"
      }
    ])

    const models = provider.getAvailableModels()
    expect(models.some(m => m.id === "deepseek-chat")).toBe(true)
    expect(models.some(m => m.id === "llama3.2:latest")).toBe(true)
  })

  it("should complete chat completion requests with proper headers and body", async () => {
    provider.setConfig({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "secret-key",
      modelName: "gpt-4o-mini"
    })

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: { content: '{"group":"work"}' },
            finish_reason: "stop"
          }
        ]
      })
    })
    globalThis.fetch = mockFetch as unknown as typeof fetch

    const res = await provider.complete({
      messages: [{ role: "user", content: "group these tabs" }],
      responseFormat: "json"
    })

    expect(res.content).toBe('{"group":"work"}')
    expect(res.finishReason).toBe("stop")
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer secret-key",
          "Content-Type": "application/json"
        }),
        body: expect.stringContaining('"response_format":{"type":"json_object"}')
      })
    )
  })

  it("should successfully test connection and measure latency", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "pong" } }] })
    })
    globalThis.fetch = mockFetch as unknown as typeof fetch

    const testRes = await provider.testConnection({
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: "gsk_test",
      modelName: "llama-3.1-8b-instant"
    })

    expect(testRes.success).toBe(true)
    expect(typeof testRes.latencyMs).toBe("number")
    expect(testRes.error).toBeUndefined()
  })

  it("should report error when test connection fails with HTTP error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "Invalid API key"
    })
    globalThis.fetch = mockFetch as unknown as typeof fetch

    const testRes = await provider.testConnection({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "bad-key",
      modelName: "gpt-4o-mini"
    })

    expect(testRes.success).toBe(false)
    expect(testRes.error).toContain("401")
    expect(testRes.error).toContain("Invalid API key")
  })
})
