import { describe, expect, it, vi } from "vitest";
import { executeWebFetch } from "../../src/tools/web-fetch.js";
import { executeWebSearch } from "../../src/tools/web-search.js";
import { MediaError } from "../../src/domain/errors.js";

const config = {
  proxyBaseUrl: "https://proxy.example.com",
  proxyApiKey: "key",
  logLevel: "error" as const,
  requestTimeoutMs: 1_000,
  maxRetries: 0,
  maxOutputChars: 100,
  fetchProviders: { defaultModel: "exa", allowedModels: ["exa", "firecrawl"], fallbackModels: ["exa", "firecrawl"] },
  searchProviders: { defaultModel: "exa", allowedModels: ["exa", "brave"], fallbackModels: ["exa", "brave"] },
};

describe("MCP tool handlers", () => {
  it("returns structured web search results", async () => {
    const client = {
      search: vi.fn().mockResolvedValue({
        provider: "exa",
        query: "test",
        answer: "A concise answer.",
        queriesUsed: 1,
        results: [{
          title: "Result",
          url: "https://example.com",
          snippet: "A snippet",
          source: "example.com",
          rank: 1,
        }],
      }),
    };
    const result = await executeWebSearch(client as never, config, {
      query: "test", search_type: "web", max_results: 5,
    });

    expect(result).toMatchObject({
      structuredContent: { query: "test", provider: "exa", metadata: { attempted_models: ["exa"] } },
    });
  });

  it("rejects unsafe web fetch targets before calling the proxy", async () => {
    const client = { fetchDocument: vi.fn() };
    const result = await executeWebFetch(client as never, config, {
      url: "http://127.0.0.1:8080", format: "markdown", max_characters: 20_000,
    });

    expect(client.fetchDocument).not.toHaveBeenCalled();
    expect(result).toMatchObject({ isError: true });
  });

  it("falls back only when auto receives a retryable failure", async () => {
    const client = {
      search: vi.fn()
        .mockRejectedValueOnce(new MediaError("UPSTREAM_UNAVAILABLE", "Unavailable", true))
        .mockResolvedValueOnce({ provider: "brave", query: "test", results: [] }),
    };
    const result = await executeWebSearch(client as never, config, {
      query: "test", model: "auto", search_type: "web", max_results: 5,
    });

    expect(client.search).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      structuredContent: {
        provider: "brave",
        metadata: { attempted_models: ["exa", "brave"], fallback_used: true },
      },
    });
  });
});
