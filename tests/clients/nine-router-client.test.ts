import { describe, expect, it, vi } from "vitest";
import { NineRouterClient } from "../../src/clients/nine-router-client.js";
import type { AppConfig } from "../../src/config/env.js";

const config: AppConfig = {
  proxyBaseUrl: "https://proxy.example.com",
  proxyApiKey: "secret-key",
  logLevel: "error",
  requestTimeoutMs: 1_000,
  maxRetries: 0,
  maxOutputChars: 100_000,
  fetchProviders: {
    defaultModel: "exa", allowedModels: ["exa", "firecrawl"], fallbackModels: ["exa", "firecrawl"],
  },
  searchProviders: {
    defaultModel: "exa", allowedModels: ["exa", "brave"], fallbackModels: ["exa", "brave"],
  },
};

describe("NineRouterClient", () => {
  it("maps proxy search data to the public domain model", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      provider: "exa",
      query: "query",
      answer: "answer",
      results: [],
      usage: { queries_used: 1 },
      metrics: { response_time_ms: 42 },
    }), { status: 200 }));
    const client = new NineRouterClient(config, fetcher);

    const result = await client.search({
      model: "exa", query: "query", searchType: "web", maxResults: 5,
    });

    expect(result.provider).toBe("exa");
    expect(fetcher).toHaveBeenCalledWith(
      "https://proxy.example.com/v1/search",
      expect.objectContaining({ method: "POST" }),
    );
    const options = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(options.headers).toMatchObject({ authorization: "Bearer secret-key" });
    expect(options.body).toBe(JSON.stringify({
      model: "exa", query: "query", search_type: "web", max_results: 5,
      country: undefined, language: undefined,
    }));
  });

  it("normalizes a rate-limit error", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: "Slow down" },
    }), { status: 429 }));
    const client = new NineRouterClient(config, fetcher);

    await expect(client.search({
      model: "exa", query: "query", searchType: "web", maxResults: 5,
    })).rejects.toMatchObject({ code: "UPSTREAM_RATE_LIMITED", retryable: true });
  });

  it("sends the 9router fetch payload and normalizes its response", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      provider: "firecrawl",
      url: "https://example.com",
      title: "Example Domain",
      content: { format: "markdown", text: "# Example", length: 9 },
      metadata: { language: "en", published_at: null },
      metrics: { response_time_ms: 100 },
    }), { status: 200 }));
    const client = new NineRouterClient(config, fetcher);

    const result = await client.fetchDocument({
      model: "firecrawl", url: "https://example.com", format: "markdown", maxCharacters: 0,
    });

    expect(result).toMatchObject({
      provider: "firecrawl",
      document: { markdown: "# Example", charCount: 9 },
    });
    const options = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(options.body).toBe(JSON.stringify({
      model: "firecrawl", url: "https://example.com", format: "markdown", max_characters: 0,
    }));
  });
});
